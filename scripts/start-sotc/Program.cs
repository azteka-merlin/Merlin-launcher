using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            bool configureOnly = args.Length == 1 && args[0] == "--configure-only";
            if (args.Length != 0 && !configureOnly)
                throw new ArgumentException("Argumento desconhecido.");

            string root = AppDomain.CurrentDomain.BaseDirectory;
            string launcher = Path.Combine(root, "SotC.exe");
            string game = Path.Combine(root, "game");
            string modules = Path.Combine(root, "user", "sys_modules");
            string dlc = Path.Combine(game, "dlc");

            RequireFile(launcher, "SotC.exe não foi encontrado ao lado deste iniciador.");
            RequireFile(Path.Combine(game, "eboot.bin"), "A pasta game não contém eboot.bin.");
            RequireFile(Path.Combine(modules, "libSceNgs2.sprx"), "Falta o módulo de som libSceNgs2.sprx.");
            RequireFile(Path.Combine(modules, "libSceUlt.sprx"), "Falta o módulo de som libSceUlt.sprx.");
            if (!Directory.Exists(dlc))
                throw new DirectoryNotFoundException("A pasta de DLC não foi encontrada: " + dlc);

            foreach (Process process in Process.GetProcessesByName("SotC"))
            {
                try
                {
                    if (!process.HasExited)
                        throw new InvalidOperationException("Feche o SotC.exe que já está aberto antes de usar este iniciador.");
                }
                finally
                {
                    process.Dispose();
                }
            }

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            if (String.IsNullOrWhiteSpace(appData))
                throw new InvalidOperationException("Não foi possível localizar AppData deste usuário.");
            string configDir = Path.Combine(appData, "sotc-launcher");
            Directory.CreateDirectory(configDir);
            string config = Path.Combine(configDir, "settings.json");

            var json = new JavaScriptSerializer { MaxJsonLength = Int32.MaxValue };
            Dictionary<string, object> settings = File.Exists(config)
                ? json.Deserialize<Dictionary<string, object>>(File.ReadAllText(config, Encoding.UTF8))
                : new Dictionary<string, object>();
            if (settings == null)
                throw new InvalidDataException("As configurações do SotC.exe não são um objeto JSON.");

            settings["game_dir"] = game;
            settings["sys_modules"] = modules;
            settings["dlc_dir"] = dlc;
            settings["user_dir"] = "";
            settings["library_dirs"] = new List<string> { root.TrimEnd('\\', '/') };
            settings["setup_done"] = true;

            string temporary = Path.Combine(configDir, ".settings-" + Guid.NewGuid().ToString("N") + ".tmp");
            try
            {
                File.WriteAllText(temporary, json.Serialize(settings), new UTF8Encoding(false));
                if (File.Exists(config)) File.Replace(temporary, config, null);
                else File.Move(temporary, config);
            }
            finally
            {
                if (File.Exists(temporary)) File.Delete(temporary);
            }

            if (configureOnly) return 0;

            Process.Start(new ProcessStartInfo(launcher)
            {
                WorkingDirectory = root,
                UseShellExecute = false
            });
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show("Não foi possível iniciar Shadow of the Colossus.\n\n" + error.Message,
                "Start SotC", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void RequireFile(string path, string message)
    {
        if (!File.Exists(path)) throw new FileNotFoundException(message, path);
    }
}
