using System;
using System.Windows.Forms;

namespace MonteithHolidayManager
{
    internal static class Program
    {
        /// <summary>
        /// Entry point. "--smoke-test" opens the app, checks it rendered, and exits with 0 (ok) or a
        /// non-zero code – used by the build to prove the packaged program works on Windows.
        /// </summary>
        [STAThread]
        private static int Main(string[] args)
        {
            bool smoke = Array.IndexOf(args, "--smoke-test") >= 0;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (var form = new MainForm(smoke))
            {
                Application.Run(form);
                return form.ExitCode;
            }
        }
    }
}
