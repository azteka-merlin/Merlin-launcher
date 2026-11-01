using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    private const string BaseFile = "The Legend of Zelda Tears of the Kingdom [0100F2C0115B6000][v0].xci";
    private const string UpdateFile = "sxs-the_legend_of_zelda_tears_of_the_kingdom_v720896.nsp";
    private const string PackageFolder = "TotK-Setup-0.2.8-windows";

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            bool validateOnly = args.Length == 1 && args[0] == "--validate-only";
            if (args.Length != 0 && !validateOnly)
                throw new ArgumentException("Argumento desconhecido.");

            string launchRoot = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory);
            string setupRoot = FindSetupRoot(launchRoot);
            string inputRoot = FindInputRoot(launchRoot, setupRoot);
            string basePath = Path.Combine(inputRoot, BaseFile);
            string updatePath = Path.Combine(inputRoot, UpdateFile);
            string keysPath = FindKeys(inputRoot);
            string destination = Path.Combine(launchRoot, "TotK-Installed");
            string python = Path.Combine(setupRoot, "python", "pythonw.exe");

            RequireFile(python, "O Python incluso no pacote nao foi encontrado.");
            RequireFile(Path.Combine(setupRoot, "installer", "merlin_gui.py"),
                "O modulo do iniciador Merlin nao foi encontrado. Extraia o pacote TotK Setup completo.");
            RequireFile(Path.Combine(setupRoot, "installer", "text", "pt.json"),
                "A traducao para portugues nao foi encontrada. Extraia o pacote TotK Setup completo.");
            RequireDirectory(inputRoot, "A pasta game nao foi encontrada junto do iniciador.");

            if (validateOnly) return 0;

            var command = new List<string>
            {
                "-m", "installer.merlin_gui",
                "--root", setupRoot,
                "--base", basePath,
                "--update", updatePath,
                "--keys", keysPath,
                "--game-lang", "pt-BR",
                "--dest", destination
            };
            var info = new ProcessStartInfo
            {
                FileName = python,
                Arguments = JoinArguments(command),
                WorkingDirectory = setupRoot,
                UseShellExecute = false
            };
            Process.Start(info);
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show("Nao foi possivel abrir o TotK Setup.\n\n" + error.Message,
                "Merlin - TotK Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static string FindSetupRoot(string launchRoot)
    {
        if (IsSetupRoot(launchRoot)) return launchRoot;

        string named = Path.Combine(launchRoot, PackageFolder);
        if (IsSetupRoot(named)) return named;

        if (Directory.Exists(launchRoot))
        {
            foreach (string child in Directory.GetDirectories(launchRoot, "*TotK-Setup*", SearchOption.TopDirectoryOnly))
                if (IsSetupRoot(child)) return Path.GetFullPath(child);
        }

        throw new DirectoryNotFoundException(
            "Nao encontrei o pacote TotK Setup ao lado deste iniciador. Mantenha o pacote completo na mesma pasta.");
    }

    private static bool IsSetupRoot(string path)
    {
        return File.Exists(Path.Combine(path, "python", "pythonw.exe"))
            && File.Exists(Path.Combine(path, "installer", "gui.py"))
            && File.Exists(Path.Combine(path, "installer", "merlin_gui.py"));
    }

    private static string FindInputRoot(string launchRoot, string setupRoot)
    {
        var candidates = new List<string>
        {
            Path.Combine(launchRoot, "game"),
            Path.Combine(setupRoot, "game"),
            launchRoot
        };

        foreach (string candidate in candidates)
            if (File.Exists(Path.Combine(candidate, BaseFile)) && File.Exists(Path.Combine(candidate, UpdateFile)))
                return Path.GetFullPath(candidate);

        foreach (string candidate in candidates)
            if (Directory.Exists(candidate)) return Path.GetFullPath(candidate);

        return Path.GetFullPath(Path.Combine(launchRoot, "game"));
    }

    private static string FindKeys(string inputRoot)
    {
        string keysRoot = Path.Combine(inputRoot, "keys");
        string standard = Path.Combine(keysRoot, "prod.keys");
        if (File.Exists(standard)) return Path.GetFullPath(standard);

        if (Directory.Exists(keysRoot))
        {
            string[] matches = Directory.GetFiles(keysRoot, "prod.keys", SearchOption.AllDirectories);
            Array.Sort(matches, StringComparer.OrdinalIgnoreCase);
            if (matches.Length == 1) return Path.GetFullPath(matches[0]);
            if (matches.Length > 1)
                throw new InvalidDataException("Encontrei mais de um prod.keys dentro da pasta game\\keys. Deixe apenas o arquivo que deseja usar.");
        }

        // Keep the expected absolute path in the UI even before the player supplies their own keys.
        return Path.GetFullPath(standard);
    }

    private static string JoinArguments(IEnumerable<string> values)
    {
        var result = new StringBuilder();
        foreach (string value in values)
        {
            if (result.Length != 0) result.Append(' ');
            result.Append(QuoteWindowsArgument(value));
        }
        return result.ToString();
    }

    private static string QuoteWindowsArgument(string value)
    {
        var result = new StringBuilder();
        result.Append('"');
        int slashes = 0;
        foreach (char ch in value)
        {
            if (ch == '\\')
            {
                slashes++;
                continue;
            }
            if (ch == '"')
            {
                result.Append('\\', slashes * 2 + 1);
                result.Append('"');
                slashes = 0;
                continue;
            }
            result.Append('\\', slashes);
            slashes = 0;
            result.Append(ch);
        }
        result.Append('\\', slashes * 2);
        result.Append('"');
        return result.ToString();
    }

    private static void RequireFile(string path, string message)
    {
        if (!File.Exists(path)) throw new FileNotFoundException(message, path);
    }

    private static void RequireDirectory(string path, string message)
    {
        if (!Directory.Exists(path)) throw new DirectoryNotFoundException(message + "\n" + path);
    }
}