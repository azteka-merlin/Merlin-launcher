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
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string launcher = Path.Combine(root, "Uncharted.exe");
            string game = Path.Combine(root, "game");
            if (!File.Exists(launcher))
                throw new FileNotFoundException("Uncharted.exe não foi encontrado ao lado deste iniciador.", launcher);
            if (!File.Exists(Path.Combine(game, "eboot.bin")))
                throw new FileNotFoundException("A pasta game não contém eboot.bin.", game);

            string documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (String.IsNullOrWhiteSpace(documents))
                throw new InvalidOperationException("Não foi possível localizar a pasta Documentos deste usuário.");
            string saves = Path.Combine(documents, "UNCHARTED The Nathan Drake Collection");
            Directory.CreateDirectory(saves);

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            if (String.IsNullOrWhiteSpace(appData))
                throw new InvalidOperationException("Não foi possível localizar AppData deste usuário.");
            string configDir = Path.Combine(appData, "uncharted-launcher");
            Directory.CreateDirectory(configDir);
            string config = Path.Combine(configDir, "settings.json");

            var json = new JavaScriptSerializer { MaxJsonLength = Int32.MaxValue };
            Dictionary<string, object> settings = File.Exists(config)
                ? json.Deserialize<Dictionary<string, object>>(File.ReadAllText(config, Encoding.UTF8))
                : new Dictionary<string, object>();
            if (settings == null)
                throw new InvalidDataException("As configurações do launcher não são um objeto JSON.");

            settings["game_dir"] = game;
            settings["user_dir"] = saves;
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

            // Useful for checking the paths without opening the graphical launcher.
            if (args.Length == 1 && args[0] == "--configure-only") return 0;

            Process.Start(new ProcessStartInfo(launcher)
            {
                WorkingDirectory = root,
                UseShellExecute = false
            });
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show("Não foi possível iniciar UNCHARTED.\n\n" + error.Message,
                "Start Uncharted", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
