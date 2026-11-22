using System;
using System.Collections.Generic;
using System.Linq;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace MerlinGameOperations
{
    [DataContract]
    internal sealed class Request
    {
        [DataMember] public string operation;
        [DataMember] public string root;
        [DataMember] public string executable;
        [DataMember] public string drive;
        [DataMember] public int graceMilliseconds;
    }

    [DataContract]
    internal sealed class Response
    {
        public Response(bool success, string code) { this.success = success; this.code = code; }
        [DataMember] public bool success;
        [DataMember] public string code;
    }

    internal sealed class GameOperationsWindowsService : ServiceBase
    {
        private const string PipeName = "Merlin.GameOperations.v1";
        private const uint PipeAccessDuplex = 0x00000003;
        private const uint PipeTypeByte = 0x00000000;
        private const uint PipeReadModeByte = 0x00000000;
        private const uint PipeWait = 0x00000000;
        private const uint PipeRejectRemoteClients = 0x00000008;
        private const uint ProcessTerminate = 0x0001;
        private const uint ProcessQueryLimitedInformation = 0x1000;
        private const uint Synchronize = 0x00100000;
        private const uint TokenQuery = 0x0008;
        private static readonly Encoding Utf8 = new UTF8Encoding(false, true);

        private volatile bool stopping;
        private Thread worker;
        private NamedPipeServerStream activePipe;

        public GameOperationsWindowsService()
        {
            ServiceName = "MerlinGameOperations";
            CanStop = true;
            CanShutdown = true;
            AutoLog = false;
        }

        protected override void OnStart(string[] args)
        {
            stopping = false;
            worker = new Thread(Serve) { IsBackground = true, Name = "Merlin game operations pipe" };
            worker.Start();
        }

        protected override void OnStop()
        {
            stopping = true;
            try { if (activePipe != null) activePipe.Dispose(); } catch { }
            if (worker != null) worker.Join(TimeSpan.FromSeconds(5));
        }

        protected override void OnShutdown() { OnStop(); }

        private void Serve()
        {
            while (!stopping)
            {
                try
                {
                    using (NamedPipeServerStream pipe = CreatePipe())
                    {
                        activePipe = pipe;
                        pipe.WaitForConnection();
                        if (!stopping) Handle(pipe);
                        activePipe = null;
                    }
                }
                catch (ObjectDisposedException) { if (!stopping) Thread.Sleep(250); }
                catch (IOException error) { if (!stopping) { InstallerOperations.WriteLog("Pipe I/O: " + error.Message); Thread.Sleep(250); } }
                catch (Exception error) { if (!stopping) { InstallerOperations.WriteLog("Pipe failure: " + error.Message); Thread.Sleep(500); } }
                finally { activePipe = null; }
            }
        }

        private static NamedPipeServerStream CreatePipe()
        {
            IntPtr descriptor;
            if (!ConvertStringSecurityDescriptorToSecurityDescriptor(
                "D:P(A;;GA;;;SY)(A;;GRGW;;;IU)", 1, out descriptor, IntPtr.Zero))
                throw new IOException("Could not create the local pipe security descriptor.");

            try
            {
                SecurityAttributes attributes = new SecurityAttributes();
                attributes.length = Marshal.SizeOf(typeof(SecurityAttributes));
                attributes.securityDescriptor = descriptor;
                attributes.inheritHandle = false;
                SafePipeHandle handle = CreateNamedPipe(
                    "\\\\.\\pipe\\" + PipeName,
                    PipeAccessDuplex,
                    PipeTypeByte | PipeReadModeByte | PipeWait | PipeRejectRemoteClients,
                    1, 16384, 16384, 0, ref attributes);
                if (handle == null || handle.IsInvalid)
                    throw new IOException("Could not create the local service pipe.", Marshal.GetExceptionForHR(Marshal.GetHRForLastWin32Error()));
                return new NamedPipeServerStream(PipeDirection.InOut, false, false, handle);
            }
            finally { LocalFree(descriptor); }
        }

        private void Handle(NamedPipeServerStream pipe)
        {
            int clientPid;
            uint clientSession;
            string clientSid;
            if (!GetNamedPipeClientProcessId(pipe.SafePipeHandle, out clientPid) ||
                !ProcessIdToSessionId((uint)clientPid, out clientSession) || clientSession == 0 ||
                !TryGetProcessUserSid(clientPid, out clientSid))
            {
                WriteResponse(pipe, new Response(false, "client_not_allowed"));
                return;
            }

            string line;
            try
            {
                line = ReadRequestLine(pipe, 8192);
            }
            catch (Exception error)
            {
                InstallerOperations.WriteLog("Rejected pipe request: " + error.Message);
                WriteResponse(pipe, new Response(false, "invalid_request"));
                return;
            }
            if (String.IsNullOrWhiteSpace(line))
            {
                WriteResponse(pipe, new Response(false, "invalid_request"));
                return;
            }

            Request request;
            try
            {
                byte[] json = Utf8.GetBytes(line);
                using (MemoryStream input = new MemoryStream(json))
                    request = (Request)new DataContractJsonSerializer(typeof(Request)).ReadObject(input);
            }
            catch { WriteResponse(pipe, new Response(false, "invalid_request")); return; }

            Response response;
            if (stopping)
                response = new Response(false, "service_stopping");
            else if (request == null)
                response = new Response(false, "operation_not_allowed");
            else if (String.Equals(request.operation, "close-game", StringComparison.Ordinal))
                response = CloseGame(request, clientSid, clientSession);
            else if (String.Equals(request.operation, "prepare-drive", StringComparison.Ordinal))
                response = PrepareDrive(request.drive, clientSid);
            else
                response = new Response(false, "operation_not_allowed");

            if (!response.success) InstallerOperations.WriteLog("Service request failed: " +
                (request == null ? "invalid_request" : request.operation) + " / " + response.code + ".");

            WriteResponse(pipe, response);
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool PeekNamedPipe(SafePipeHandle handle, IntPtr buffer, uint size,
            IntPtr bytesRead, out uint available, IntPtr remaining);

        private static string ReadRequestLine(NamedPipeServerStream stream, int maximumBytes)
        {
            byte[] buffer = new byte[maximumBytes + 1];
            int length = 0;
            Stopwatch elapsed = Stopwatch.StartNew();
            while (elapsed.ElapsedMilliseconds < 5000)
            {
                uint available;
                if (!PeekNamedPipe(stream.SafePipeHandle, IntPtr.Zero, 0, IntPtr.Zero, out available, IntPtr.Zero))
                    throw new IOException("Pipe disconnected.");
                if (available == 0) { Thread.Sleep(20); continue; }
                int read = stream.Read(buffer, length, (int)Math.Min(available, (uint)(buffer.Length - length)));
                int newline = Array.IndexOf(buffer, (byte)'\n', length, read);
                if (newline >= 0) return Utf8.GetString(buffer, 0, newline).TrimEnd('\r');
                length += read;
                if (read == 0 || length == buffer.Length) throw new InvalidDataException("Invalid pipe frame.");
            }
            throw new System.TimeoutException("Pipe request timed out.");
        }

        private Response CloseGame(Request request, string clientSid, uint clientSession)
        {
            if (stopping) return new Response(false, "service_stopping");
            string root;
            string executable;
            if (!TryValidateGamePaths(request.root, request.executable, clientSid, out root, out executable))
                return new Response(false, "game_path_not_allowed");

            Process[] processes;
            try { processes = Process.GetProcesses(); }
            catch { return new Response(false, "process_list_unavailable"); }

            bool found = false;
            foreach (Process process in processes)
            {
                try
                {
                    uint session;
                    string image;
                    if (!ProcessIdToSessionId((uint)process.Id, out session) || session != clientSession ||
                        !TryGetImagePath(process.Id, ProcessQueryLimitedInformation, out image) ||
                        !IsTargetProcess(image, executable, root)) continue;
                    found = true;
                    try { process.CloseMainWindow(); } catch { }
                }
                catch { }
                finally { process.Dispose(); }
            }
            if (!found) return new Response(false, "game_not_running");

            int graceMilliseconds = Math.Max(0, Math.Min(12000, request.graceMilliseconds));
            DateTime deadline = DateTime.UtcNow.AddMilliseconds(graceMilliseconds);
            while (DateTime.UtcNow < deadline)
            {
                if (stopping) return new Response(false, "service_stopping");
                if (!HasTargetProcess(root, executable, clientSession))
                    return new Response(true, "closed");
                Thread.Sleep(300);
            }

            if (stopping) return new Response(false, "service_stopping");

            bool accessDenied = false;
            foreach (Process process in SafeGetProcesses())
            {
                try
                {
                    uint session;
                    string image;
                    if (!ProcessIdToSessionId((uint)process.Id, out session) || session != clientSession ||
                        !TryGetImagePath(process.Id, ProcessQueryLimitedInformation, out image) ||
                        !IsTargetProcess(image, executable, root)) continue;

                    if (!TerminateTarget(process.Id, root, executable, clientSession)) accessDenied = true;
                }
                catch { accessDenied = true; }
                finally { process.Dispose(); }
            }

            deadline = DateTime.UtcNow.AddSeconds(4);
            while (DateTime.UtcNow < deadline)
            {
                if (stopping) return new Response(false, "service_stopping");
                if (!HasTargetProcess(root, executable, clientSession)) return new Response(true, "closed");
                Thread.Sleep(250);
            }
            return new Response(false, accessDenied ? "access_denied" : "close_timeout");
        }

        private static Response PrepareDrive(string inputDrive, string clientSid)
        {
            try
            {
                if (String.IsNullOrWhiteSpace(inputDrive) || inputDrive.Length != 1 ||
                    Char.ToUpperInvariant(inputDrive[0]) < 'C' || Char.ToUpperInvariant(inputDrive[0]) > 'Z')
                    return new Response(false, "drive_not_allowed");

                string driveRoot = Char.ToUpperInvariant(inputDrive[0]) + ":\\";
                uint driveType = GetDriveType(driveRoot);
                if ((driveType != 2 && driveType != 3) || !Directory.Exists(driveRoot))
                    return new Response(false, "drive_not_allowed");

                string gamesRoot = Path.Combine(driveRoot, "Merlin-games");
                if (!Directory.Exists(gamesRoot)) Directory.CreateDirectory(gamesRoot);
                if (HasReparsePoint(gamesRoot)) return new Response(false, "game_path_not_allowed");
                InstallerOperations.EnsureModifyAccess(gamesRoot, clientSid);
                return new Response(true, "ready");
            }
            catch (UnauthorizedAccessException) { return new Response(false, "access_denied"); }
            catch (IOException) { return new Response(false, "drive_unavailable"); }
            catch { return new Response(false, "permission_configuration_failed"); }
        }

        private static bool TryValidateGamePaths(string inputRoot, string inputExecutable, string clientSid,
            out string root, out string executable)
        {
            root = null;
            executable = null;
            try
            {
                if (String.IsNullOrWhiteSpace(inputRoot) || String.IsNullOrWhiteSpace(inputExecutable) ||
                    inputRoot.Length > 1024 || inputExecutable.Length > 512) return false;
                string fullRoot = Path.GetFullPath(inputRoot);
                string drive = Path.GetPathRoot(fullRoot);
                if (drive.Length != 3 || drive[1] != ':') return false;
                string relative = fullRoot.Substring(drive.Length);
                string[] rootParts = relative.Split(new[] { '\\' }, StringSplitOptions.RemoveEmptyEntries);
                if (rootParts.Length != 2 || !String.Equals(rootParts[0], "Merlin-games", StringComparison.OrdinalIgnoreCase) ||
                    !IsSafePathSegment(rootParts[1])) return false;
                if (!String.Equals(fullRoot.TrimEnd('\\'), inputRoot.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)) return false;
                if (!Directory.Exists(fullRoot) || HasReparsePoint(Path.GetPathRoot(fullRoot)) ||
                    HasReparsePoint(Path.Combine(drive, "Merlin-games")) || HasReparsePoint(fullRoot)) return false;

                string gamesRoot = Path.Combine(drive, "Merlin-games");
                if (!InstallerOperations.HasModifyGrant(gamesRoot, clientSid)) return false;

                string normalized = inputExecutable.Replace('/', '\\');
                if (Path.IsPathRooted(normalized) || normalized.IndexOf(':') >= 0 ||
                    !normalized.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return false;
                string[] executableParts = normalized.Split('\\');
                if (executableParts.Length == 0) return false;
                foreach (string part in executableParts) if (!IsSafePathSegment(part)) return false;
                string fullExecutable = Path.GetFullPath(Path.Combine(fullRoot, normalized));
                if (!fullExecutable.StartsWith(fullRoot.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase) ||
                    !File.Exists(fullExecutable) || HasReparsePath(fullRoot, fullExecutable)) return false;

                root = fullRoot.TrimEnd('\\');
                executable = fullExecutable;
                return true;
            }
            catch { return false; }
        }

        private static bool IsSafePathSegment(string value)
        {
            if (String.IsNullOrWhiteSpace(value) || value == "." || value == ".." || value.Length > 240 ||
                value.EndsWith(".", StringComparison.Ordinal) || value.EndsWith(" ", StringComparison.Ordinal)) return false;
            foreach (char ch in value)
                if (ch < 32 || ch == '<' || ch == '>' || ch == ':' || ch == '"' || ch == '/' || ch == '\\' || ch == '|' || ch == '?' || ch == '*')
                    return false;
            return true;
        }

        internal static bool HasReparsePoint(string path)
        {
            try
            {
                FileAttributes attributes = File.GetAttributes(path);
                return (attributes & FileAttributes.ReparsePoint) != 0;
            }
            catch { return true; }
        }

        private static bool HasReparsePath(string root, string target)
        {
            string relative = target.Substring(root.Length).TrimStart('\\');
            string current = root;
            foreach (string part in relative.Split('\\'))
            {
                current = Path.Combine(current, part);
                if (HasReparsePoint(current)) return true;
            }
            return false;
        }

        private static bool IsTargetProcess(string image, string executable, string root)
        {
            if (String.IsNullOrWhiteSpace(image)) return false;
            string full;
            try { full = Path.GetFullPath(image); } catch { return false; }
            return String.Equals(full, executable, StringComparison.OrdinalIgnoreCase) ||
                full.StartsWith(root + "\\", StringComparison.OrdinalIgnoreCase);
        }

        private static bool HasTargetProcess(string root, string executable, uint sessionId)
        {
            foreach (Process process in SafeGetProcesses())
            {
                try
                {
                    uint session;
                    string image;
                    if (ProcessIdToSessionId((uint)process.Id, out session) && session == sessionId &&
                        TryGetImagePath(process.Id, ProcessQueryLimitedInformation, out image) &&
                        IsTargetProcess(image, executable, root)) return true;
                }
                catch { }
                finally { process.Dispose(); }
            }
            return false;
        }

        private static Process[] SafeGetProcesses()
        {
            try { return Process.GetProcesses(); } catch { return new Process[0]; }
        }

        private static bool TerminateTarget(int processId, string root, string executable, uint clientSession)
        {
            using (SafeProcessHandle handle = OpenProcess(ProcessTerminate | ProcessQueryLimitedInformation | Synchronize,
                false, processId))
            {
                if (handle == null || handle.IsInvalid) return false;
                StringBuilder image = new StringBuilder(32768);
                int size = image.Capacity;
                uint session;
                if (!ProcessIdToSessionId((uint)processId, out session) || session != clientSession ||
                    !QueryFullProcessImageName(handle, 0, image, ref size) ||
                    !IsTargetProcess(image.ToString(), executable, root)) return false;
                return TerminateProcess(handle, 1);
            }
        }

        private static bool TryGetImagePath(int processId, uint access, out string image)
        {
            image = null;
            using (SafeProcessHandle handle = OpenProcess(access, false, processId))
            {
                if (handle == null || handle.IsInvalid) return false;
                StringBuilder buffer = new StringBuilder(32768);
                int size = buffer.Capacity;
                if (!QueryFullProcessImageName(handle, 0, buffer, ref size)) return false;
                image = buffer.ToString();
                return !String.IsNullOrWhiteSpace(image);
            }
        }

        internal static bool TryGetProcessUserSid(int processId, out string sid)
        {
            sid = null;
            using (SafeProcessHandle process = OpenProcess(ProcessQueryLimitedInformation, false, processId))
            {
                if (process == null || process.IsInvalid) return false;
                IntPtr token;
                if (!OpenProcessToken(process, TokenQuery, out token)) return false;
                try
                {
                    using (WindowsIdentity identity = new WindowsIdentity(token))
                    {
                        sid = identity.User == null ? null : identity.User.Value;
                        return !String.IsNullOrWhiteSpace(sid);
                    }
                }
                finally { CloseHandle(token); }
            }
        }

        private static void WriteResponse(Stream pipe, Response response)
        {
            try
            {
                DataContractJsonSerializer serializer = new DataContractJsonSerializer(typeof(Response));
                serializer.WriteObject(pipe, response);
                pipe.WriteByte((byte)'\n');
                pipe.Flush();
            }
            catch { }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct SecurityAttributes
        {
            public int length;
            public IntPtr securityDescriptor;
            [MarshalAs(UnmanagedType.Bool)] public bool inheritHandle;
        }

        private sealed class SafeProcessHandle : SafeHandle
        {
            public SafeProcessHandle() : base(IntPtr.Zero, true) { }
            public override bool IsInvalid { get { return handle == IntPtr.Zero || handle == new IntPtr(-1); } }
            protected override bool ReleaseHandle() { return CloseHandle(handle); }
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern SafePipeHandle CreateNamedPipe(string name, uint openMode, uint pipeMode,
            uint maxInstances, uint outBufferSize, uint inBufferSize, uint timeout, ref SecurityAttributes attributes);
        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string sddl, uint revision,
            out IntPtr descriptor, IntPtr size);
        [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe, out int processId);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool ProcessIdToSessionId(uint processId, out uint sessionId);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern SafeProcessHandle OpenProcess(uint access, bool inherit, int processId);
        [DllImport("advapi32.dll", SetLastError = true)] private static extern bool OpenProcessToken(SafeProcessHandle process, uint access, out IntPtr token);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool QueryFullProcessImageName(SafeProcessHandle process, uint flags, StringBuilder image, ref int size);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool TerminateProcess(SafeProcessHandle process, uint exitCode);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern uint GetDriveType(string rootPath);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CloseHandle(IntPtr handle);
    }

    internal static class Program
    {
        private static void Main(string[] args)
        {
            if (args != null && args.Length > 0)
            {
                Environment.ExitCode = InstallerOperations.Run(args);
                return;
            }
            ServiceBase.Run(new GameOperationsWindowsService());
        }
    }

    internal static class InstallerOperations
    {
        private const string ServiceName = "MerlinGameOperations";
        private const string ServiceFileName = "MerlinGameOperationsService.exe";
        private static readonly string[] SteamFiles = {
            "OpenSteamTool.dll", "dwmapi.dll", "xinput1_4.dll", "merlin-helper.dll", "merlin_cloud_redirect.dll"
        };

        internal static int Run(string[] args)
        {
            try
            {
                if (args.Length == 1 && args[0] == "--install-service") return InstallService();
                if (args.Length == 1 && args[0] == "--remove-service") return RemoveService();
                if (args.Length == 1 && args[0] == "--configure-game-folders") return ConfigureDefaultGameFolder();
                if (args.Length == 3 && args[0] == "--install-steam-dlls") return InstallSteamFiles(args[1], args[2]);
                WriteLog("Rejected unsupported command-line operation.");
                return 2;
            }
            catch (Exception error)
            {
                WriteLog("Installer operation failed: " + error);
                return 1;
            }
        }

        internal static void WriteLog(string message)
        {
            try
            {
                // Unprivileged command-line invocations must not create a
                // writable service directory before an elevated setup secures it.
                if (!IsAdministrator()) return;
                string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Merlin", "GameOperations");
                if (!TrustedServiceDirectory(Path.GetDirectoryName(directory)) || !TrustedServiceDirectory(directory)) return;
                string log = Path.Combine(directory, "operations.log");
                if (File.Exists(log) && GameOperationsWindowsService.HasReparsePoint(log)) return;
                File.AppendAllText(Path.Combine(directory, "operations.log"),
                    DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine, new UTF8Encoding(false));
            }
            catch { }
        }

        internal static void EnsureModifyAccess(string directory, string sidValue)
        {
            // Pin the local directory during the path-based ACL calls. Deny concurrent
            // writes/deletes and open the reparse point itself instead of following it.
            using (SafeFileHandle handle = CreateFile(directory, 0x80, 1, IntPtr.Zero, 3,
                0x02000000 | 0x00200000, IntPtr.Zero))
            {
                if (handle.IsInvalid || GameOperationsWindowsService.HasReparsePoint(directory))
                    throw new IOException("Cannot safely update the game directory ACL.");
                GrantModifyAccess(directory, sidValue);
            }
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern SafeFileHandle CreateFile(string path, uint access, uint share, IntPtr security,
            uint disposition, uint flags, IntPtr template);

        private static void GrantModifyAccess(string directory, string sidValue)
        {
            SecurityIdentifier sid = new SecurityIdentifier(sidValue);
            DirectorySecurity security = Directory.GetAccessControl(directory);
            AuthorizationRuleCollection rules = security.GetAccessRules(true, true, typeof(SecurityIdentifier));
            bool exists = false;
            foreach (FileSystemAccessRule rule in rules)
            {
                SecurityIdentifier identity = rule.IdentityReference as SecurityIdentifier;
                if (identity != null && identity.Equals(sid) && rule.AccessControlType == AccessControlType.Allow &&
                    (rule.FileSystemRights & FileSystemRights.Modify) == FileSystemRights.Modify &&
                    (rule.InheritanceFlags & (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit)) ==
                        (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit) &&
                    rule.PropagationFlags == PropagationFlags.None)
                {
                    exists = true;
                    break;
                }
            }
            if (!exists)
            {
                security.AddAccessRule(new FileSystemAccessRule(sid, FileSystemRights.Modify,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                    PropagationFlags.None, AccessControlType.Allow));
                Directory.SetAccessControl(directory, security);
            }
            DirectorySecurity verified = Directory.GetAccessControl(directory);
            bool hasGrant = verified.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().Any(rule =>
                rule.IdentityReference.Equals(sid) && rule.AccessControlType == AccessControlType.Allow &&
                (rule.FileSystemRights & FileSystemRights.Modify) == FileSystemRights.Modify &&
                (rule.InheritanceFlags & (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit)) ==
                    (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit));
            if (!hasGrant) throw new UnauthorizedAccessException("The inherited Modify rule could not be verified for " + sid.Value + ".");
        }

        internal static bool HasModifyGrant(string directory, string sidValue)
        {
            try
            {
                if (!Directory.Exists(directory) || GameOperationsWindowsService.HasReparsePoint(directory)) return false;
                SecurityIdentifier sid = new SecurityIdentifier(sidValue);
                DirectorySecurity security = Directory.GetAccessControl(directory);
                return security.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().Any(rule =>
                    rule.IdentityReference.Equals(sid) && rule.AccessControlType == AccessControlType.Allow &&
                    (rule.FileSystemRights & FileSystemRights.Modify) == FileSystemRights.Modify &&
                    (rule.InheritanceFlags & (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit)) ==
                        (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit) &&
                    rule.PropagationFlags == PropagationFlags.None);
            }
            catch { return false; }
        }

        private static bool IsAdministrator()
        {
            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
                return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }

        private static string InteractiveUserSid()
        {
            int session = Process.GetCurrentProcess().SessionId;
            foreach (Process process in Process.GetProcessesByName("explorer"))
            {
                try
                {
                    if (process.SessionId != session) continue;
                    string sid;
                    if (GameOperationsWindowsService.TryGetProcessUserSid(process.Id, out sid)) return sid;
                }
                catch { }
                finally { process.Dispose(); }
            }
            return null;
        }

        private static int ConfigureDefaultGameFolder()
        {
            if (!IsAdministrator()) { WriteLog("Default game folder configuration requires elevation."); return 10; }
            string sid = InteractiveUserSid();
            if (String.IsNullOrWhiteSpace(sid)) { WriteLog("Could not resolve the interactive user's SID."); return 11; }
            try
            {
                EnsureSecureServiceDirectory();
                Response response = PrepareGameDrive("C", sid);
                if (!response.success) { WriteLog("C:\\Merlin-games configuration failed: " + response.code); return 12; }
                WriteLog("Configured inherited Modify access on C:\\Merlin-games for " + sid + ".");
                return 0;
            }
            catch (Exception error) { WriteLog("C:\\Merlin-games configuration failed: " + error); return 12; }
        }

        private static Response PrepareGameDrive(string inputDrive, string sid)
        {
            if (String.IsNullOrWhiteSpace(inputDrive) || inputDrive.Length != 1 ||
                Char.ToUpperInvariant(inputDrive[0]) < 'C' || Char.ToUpperInvariant(inputDrive[0]) > 'Z')
                return new Response(false, "drive_not_allowed");
            string root = Char.ToUpperInvariant(inputDrive[0]) + ":\\";
            uint type = GetDriveType(root);
            if ((type != 2 && type != 3) || !Directory.Exists(root)) return new Response(false, "drive_not_allowed");
            string folder = Path.Combine(root, "Merlin-games");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
            if (GameOperationsWindowsService.HasReparsePoint(folder)) return new Response(false, "game_path_not_allowed");
            EnsureModifyAccess(folder, sid);
            return new Response(true, "ready");
        }

        private static int InstallService()
        {
            if (!IsAdministrator()) { WriteLog("Service installation requires elevation."); return 20; }
            string sid = InteractiveUserSid();
            if (String.IsNullOrWhiteSpace(sid)) { WriteLog("Could not resolve the interactive user's SID for game folder permissions."); return 21; }
            Response folder = PrepareGameDrive("C", sid);
            if (!folder.success) { WriteLog("C:\\Merlin-games configuration failed: " + folder.code); return 22; }

            string source = Assembly.GetExecutingAssembly().Location;
            string serviceDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Merlin", "GameOperations");
            string destination = Path.Combine(serviceDirectory, ServiceFileName);
            string temporary = Path.Combine(serviceDirectory, "." + ServiceFileName + "." + Guid.NewGuid().ToString("N") + ".tmp");
            string backup = temporary + ".bak";
            bool hadPreviousService = true;
            bool serviceExisted = false;
            bool serviceCreated = false;
            try
            {
                EnsureSecureServiceDirectory();
                if ((File.Exists(destination) || Directory.Exists(destination)) &&
                    GameOperationsWindowsService.HasReparsePoint(destination))
                    throw new IOException("Refusing to replace a reparse-point service binary.");
                hadPreviousService = File.Exists(destination);
                if (hadPreviousService) ApplyServiceFileAcl(destination);
                int initialServiceQuery = RunSc("query " + ServiceName);
                if (initialServiceQuery != 0 && initialServiceQuery != 1060)
                    throw new IOException("The existing service could not be inspected (sc.exe " + initialServiceQuery + ").");
                serviceExisted = initialServiceQuery == 0;
                StopServiceIfInstalled();
                string sourceHash = HashFile(source);
                bool currentMatches = File.Exists(destination) && HashFile(destination) == sourceHash;
                if (!currentMatches)
                {
                    File.Copy(source, temporary, false);
                    if (HashFile(temporary) != sourceHash) throw new IOException("The copied service failed SHA-256 verification.");
                    if (File.Exists(destination)) File.Replace(temporary, destination, backup, true);
                    else File.Move(temporary, destination);
                }
                ApplyServiceFileAcl(destination);
                if (HashFile(destination) != sourceHash)
                    throw new IOException("The installed service binary failed SHA-256 verification.");
                int result = RunSc("query " + ServiceName);
                if (result == 1060)
                {
                    result = RunSc("create " + ServiceName + " binPath= \"\\\"" + destination + "\\\"\" start= auto obj= LocalSystem DisplayName= \"Merlin Game Operations\"");
                    serviceCreated = result == 0;
                }
                else if (result != 0) throw new IOException("The service could not be inspected before registration (sc.exe " + result + ").");
                else result = RunSc("config " + ServiceName + " binPath= \"\\\"" + destination + "\\\"\" start= auto obj= LocalSystem DisplayName= \"Merlin Game Operations\"");
                if (result != 0) throw new IOException("Service registration failed with sc.exe exit code " + result + ".");
                using (ServiceController service = new ServiceController(ServiceName))
                {
                    service.Refresh();
                    if (service.Status != ServiceControllerStatus.Running) service.Start();
                    service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
                }
                if (File.Exists(backup)) File.Delete(backup);
                WriteLog("Installed and started the MerlinGameOperations service; game folder owner SID " + sid + ".");
                return 0;
            }
            catch (Exception error)
            {
                WriteLog("Service installation failed: " + error);
                TryDelete(temporary);
                if (serviceCreated)
                {
                    try { StopServiceIfInstalled(); } catch (Exception rollback) { WriteLog("New service stop during rollback failed: " + rollback); }
                    try { RunSc("delete " + ServiceName); } catch (Exception rollback) { WriteLog("New service removal during rollback failed: " + rollback); }
                }
                if (File.Exists(backup) && File.Exists(destination))
                {
                    try { File.Replace(backup, destination, null, true); ApplyServiceFileAcl(destination); }
                    catch (Exception rollback) { WriteLog("Service rollback failed: " + rollback); }
                }
                else if (!hadPreviousService) TryDelete(destination);
                if (serviceExisted)
                {
                    try
                    {
                        using (ServiceController service = new ServiceController(ServiceName))
                        {
                            service.Refresh();
                            if (service.Status == ServiceControllerStatus.Stopped) service.Start();
                            service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
                        }
                    }
                    catch (Exception rollback) { WriteLog("Previous service could not be restarted after rollback: " + rollback); }
                }
                return 23;
            }
        }

        private static void StopServiceIfInstalled()
        {
            foreach (ServiceController service in ServiceController.GetServices())
            {
                using (service)
                {
                    if (!String.Equals(service.ServiceName, ServiceName, StringComparison.OrdinalIgnoreCase)) continue;
                    service.Refresh();
                    if (service.Status != ServiceControllerStatus.Stopped)
                    {
                        service.Stop();
                        service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20));
                    }
                    return;
                }
            }
        }

        private static void EnsureSecureServiceDirectory()
        {
            string programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            string merlinDirectory = Path.Combine(programData, "Merlin");
            string serviceDirectory = Path.Combine(merlinDirectory, "GameOperations");
            if (GameOperationsWindowsService.HasReparsePoint(programData))
                throw new IOException("The ProgramData directory is not safe for the Merlin service.");
            Directory.CreateDirectory(merlinDirectory);
            if (!TrustedServiceDirectory(merlinDirectory)) throw new IOException("Untrusted Merlin directory.");
            ApplyServiceDirectoryAcl(merlinDirectory);
            Directory.CreateDirectory(serviceDirectory);
            if (!TrustedServiceDirectory(serviceDirectory)) throw new IOException("Untrusted service directory.");
            ApplyServiceDirectoryAcl(serviceDirectory);
            if (GameOperationsWindowsService.HasReparsePoint(serviceDirectory))
                throw new IOException("The Merlin service directory changed during setup.");
        }

        private static bool TrustedServiceDirectory(string directory)
        {
            if (GameOperationsWindowsService.HasReparsePoint(directory)) return false;
            DirectorySecurity security = Directory.GetAccessControl(directory);
            SecurityIdentifier owner = (SecurityIdentifier)security.GetOwner(typeof(SecurityIdentifier));
            return owner.IsWellKnown(WellKnownSidType.LocalSystemSid) ||
                owner.IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid);
        }

        private static void ApplyServiceDirectoryAcl(string directory)
        {
            SecurityIdentifier system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            SecurityIdentifier administrators = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);
            SecurityIdentifier users = new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null);
            InheritanceFlags inherited = InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit;
            DirectorySecurity security = new DirectorySecurity();
            security.SetAccessRuleProtection(true, true);
            security.SetOwner(administrators);
            security.AddAccessRule(new FileSystemAccessRule(system, FileSystemRights.FullControl,
                inherited, PropagationFlags.None, AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(administrators, FileSystemRights.FullControl,
                inherited, PropagationFlags.None, AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(users, FileSystemRights.ReadAndExecute,
                inherited, PropagationFlags.None, AccessControlType.Allow));
            Directory.SetAccessControl(directory, security);

            DirectorySecurity verified = Directory.GetAccessControl(directory);
            bool systemCanWrite = verified.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().Any(rule =>
                rule.IdentityReference.Equals(system) && rule.AccessControlType == AccessControlType.Allow &&
                (rule.FileSystemRights & FileSystemRights.FullControl) == FileSystemRights.FullControl);
            bool adminsCanWrite = verified.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().Any(rule =>
                rule.IdentityReference.Equals(administrators) && rule.AccessControlType == AccessControlType.Allow &&
                (rule.FileSystemRights & FileSystemRights.FullControl) == FileSystemRights.FullControl);
            if (!systemCanWrite || !adminsCanWrite)
                throw new UnauthorizedAccessException("The Merlin service directory ACL could not be verified.");
        }

        private static void ApplyServiceFileAcl(string file)
        {
            SecurityIdentifier system = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            SecurityIdentifier administrators = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);
            SecurityIdentifier users = new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid, null);
            FileSecurity security = new FileSecurity();
            security.SetAccessRuleProtection(true, true);
            security.SetOwner(administrators);
            security.AddAccessRule(new FileSystemAccessRule(system, FileSystemRights.FullControl, AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(administrators, FileSystemRights.FullControl, AccessControlType.Allow));
            security.AddAccessRule(new FileSystemAccessRule(users, FileSystemRights.ReadAndExecute, AccessControlType.Allow));
            File.SetAccessControl(file, security);

            FileSecurity verified = File.GetAccessControl(file);
            bool systemCanWrite = verified.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().Any(rule =>
                rule.IdentityReference.Equals(system) && rule.AccessControlType == AccessControlType.Allow &&
                (rule.FileSystemRights & FileSystemRights.FullControl) == FileSystemRights.FullControl);
            bool adminsCanWrite = verified.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().Any(rule =>
                rule.IdentityReference.Equals(administrators) && rule.AccessControlType == AccessControlType.Allow &&
                (rule.FileSystemRights & FileSystemRights.FullControl) == FileSystemRights.FullControl);
            if (!systemCanWrite || !adminsCanWrite)
                throw new UnauthorizedAccessException("The Merlin service binary ACL could not be verified.");
        }

        private static int RemoveService()
        {
            if (!IsAdministrator()) { WriteLog("Service removal requires elevation."); return 30; }
            try
            {
                StopServiceIfInstalled();
                int code = RunSc("delete " + ServiceName);
                if (code != 0 && code != 1060 && code != 1072) throw new IOException("Service removal failed with sc.exe exit code " + code + ".");
                string file = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Merlin", "GameOperations", ServiceFileName);
                string runningFile = Assembly.GetExecutingAssembly().Location;
                bool launchedFromServiceLocation = String.Equals(Path.GetFullPath(file), Path.GetFullPath(runningFile), StringComparison.OrdinalIgnoreCase);
                for (int i = 0; !launchedFromServiceLocation && i < 20 && File.Exists(file); i++)
                {
                    try { File.Delete(file); } catch { Thread.Sleep(250); }
                }
                if (!launchedFromServiceLocation && File.Exists(file)) throw new IOException("The helper service file is still in use.");
                WriteLog("Removed the MerlinGameOperations service.");
                return 0;
            }
            catch (Exception error) { WriteLog("Service removal failed: " + error); return 31; }
        }

        private static int InstallSteamFiles(string steamPath, string sourceDirectory)
        {
            if (!IsAdministrator()) { WriteLog("Steam component installation requires elevation."); return 40; }
            string root;
            try { root = Path.GetFullPath(steamPath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
            catch { WriteLog("Steam path is invalid."); return 41; }
            string windowsDirectory = Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.Windows)).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            string driveRoot = Path.GetPathRoot(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            bool isWindowsDirectory = String.Equals(root, windowsDirectory, StringComparison.OrdinalIgnoreCase) ||
                root.StartsWith(windowsDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
            if (String.IsNullOrWhiteSpace(root) || String.Equals(root, driveRoot, StringComparison.OrdinalIgnoreCase) ||
                isWindowsDirectory || !File.Exists(Path.Combine(root, "steam.exe")) || GameOperationsWindowsService.HasReparsePoint(root))
            { WriteLog("Steam path did not pass validation: " + root); return 41; }
            string sourceRoot;
            try { sourceRoot = Path.GetFullPath(sourceDirectory); }
            catch { WriteLog("Bundled component directory is invalid."); return 42; }
            if (!Directory.Exists(sourceRoot) || GameOperationsWindowsService.HasReparsePoint(sourceRoot))
            { WriteLog("Bundled component directory did not pass validation."); return 42; }

            List<SteamCopy> copies = new List<SteamCopy>();
            foreach (string name in SteamFiles)
            {
                string source = Path.Combine(sourceRoot, name);
                if (!File.Exists(source) || GameOperationsWindowsService.HasReparsePoint(source))
                { WriteLog("Bundled Steam component is missing or unsafe: " + name); return 42; }
                FileInfo info = new FileInfo(source);
                if (info.Length <= 0 || info.Length > 64 * 1024 * 1024) { WriteLog("Bundled component size is invalid: " + name); return 42; }
                copies.Add(new SteamCopy { Name = name, Source = source, Destination = Path.Combine(root, name), Hash = HashFile(source) });
            }
            Process[] steamProcesses = Process.GetProcessesByName("steam");
            bool steamRunning = steamProcesses.Length > 0;
            foreach (Process process in steamProcesses) process.Dispose();
            if (steamRunning)
            {
                WriteLog("Steam is running; no Steam files were changed.");
                return 43;
            }

            string programData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Merlin", "GameOperations");
            EnsureSecureServiceDirectory();
            string stage = Path.Combine(root, ".merlin-install-" + Guid.NewGuid().ToString("N"));
            string backups = Path.Combine(programData, "steam-backups", DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N"));
            List<SteamCopy> changed = new List<SteamCopy>();
            try
            {
                foreach (SteamCopy copy in copies)
                {
                    if (File.Exists(copy.Destination) && GameOperationsWindowsService.HasReparsePoint(copy.Destination))
                        throw new IOException("Refusing to replace a reparse-point Steam file: " + copy.Name + ".");
                    if (File.Exists(copy.Destination) && HashFile(copy.Destination) == copy.Hash)
                    { copy.AlreadyCorrect = true; continue; }
                    Directory.CreateDirectory(stage);
                    copy.Staged = Path.Combine(stage, copy.Name + ".new");
                    File.Copy(copy.Source, copy.Staged, false);
                    if (HashFile(copy.Staged) != copy.Hash) throw new IOException("Staged SHA-256 verification failed for " + copy.Name + ".");
                }
                foreach (SteamCopy copy in copies)
                {
                    if (copy.AlreadyCorrect) continue;
                    copy.Existed = File.Exists(copy.Destination);
                    if (copy.Existed)
                    {
                        Directory.CreateDirectory(backups);
                        copy.Backup = Path.Combine(backups, copy.Name);
                        File.Copy(copy.Destination, copy.Backup, false);
                        copy.PreviousHash = HashFile(copy.Destination);
                        if (HashFile(copy.Backup) != copy.PreviousHash) throw new IOException("Backup verification failed for " + copy.Name + ".");
                        changed.Add(copy);
                        File.Replace(copy.Staged, copy.Destination, null, true);
                    }
                    else
                    {
                        File.Move(copy.Staged, copy.Destination);
                        changed.Add(copy);
                    }
                    if (HashFile(copy.Destination) != copy.Hash) throw new IOException("Installed SHA-256 verification failed for " + copy.Name + ".");
                }
                WriteLog("Steam components installed and verified. Changed: " + String.Join(", ", changed.Select(item => item.Name).ToArray()) + ".");
                return 0;
            }
            catch (Exception error)
            {
                WriteLog("Steam component installation failed; rolling back: " + error);
                for (int i = changed.Count - 1; i >= 0; i--)
                {
                    SteamCopy copy = changed[i];
                    try
                    {
                        if (copy.Existed && File.Exists(copy.Backup))
                        {
                            string restore = Path.Combine(stage, copy.Name + ".restore");
                            File.Copy(copy.Backup, restore, true);
                            if (HashFile(restore) != copy.PreviousHash) throw new IOException("Rollback copy failed verification for " + copy.Name + ".");
                            File.Replace(restore, copy.Destination, null, true);
                        }
                        else if (File.Exists(copy.Destination)) File.Delete(copy.Destination);
                    }
                    catch (Exception rollback) { WriteLog("Steam DLL rollback failed for " + copy.Name + ": " + rollback); }
                }
                return 44;
            }
            finally
            {
                try { if (Directory.Exists(stage)) Directory.Delete(stage, true); } catch { }
            }
        }

        private static int RunSc(string arguments)
        {
            ProcessStartInfo info = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "sc.exe"), arguments)
            { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden };
            using (Process process = Process.Start(info))
            {
                if (process == null || !process.WaitForExit(20000)) throw new IOException("sc.exe did not finish.");
                return process.ExitCode;
            }
        }

        private static string HashFile(string path)
        {
            using (FileStream stream = File.OpenRead(path))
            using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }

        private static void TryDelete(string path) { try { if (File.Exists(path)) File.Delete(path); } catch { } }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern uint GetDriveType(string rootPath);

        private sealed class SteamCopy
        {
            public string Name, Source, Destination, Hash, Staged, Backup, PreviousHash;
            public bool Existed, AlreadyCorrect;
        }
    }
}
