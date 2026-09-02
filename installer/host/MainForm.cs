using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MonteithHolidayManager
{
    /// <summary>The one window: a WebView2 control showing the single-file app.</summary>
    internal sealed class MainForm : Form
    {
        private const string AppFileName = "Monteith Holiday Manager.html";
        private const string VirtualHost = "monteith-holiday-manager.app";
        private readonly WebView2 _web = new WebView2 { Dock = DockStyle.Fill };
        private readonly bool _smoke;
        private readonly string _dataDir;
        private bool _closingChecked;
        private Timer _smokeWatchdog;

        public int ExitCode { get; private set; }

        public MainForm(bool smoke)
        {
            _smoke = smoke;
            _dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Monteith Holiday Manager", "Data");
            Text = "Monteith Holiday Manager";
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { /* keep the default icon */ }
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1280, 860);
            MinimumSize = new Size(720, 520);
            BackColor = Color.FromArgb(255, 249, 245);
            Controls.Add(_web);
            RestoreWindowBounds();
            Load += OnLoad;
            FormClosing += OnFormClosing;
        }

        private async void OnLoad(object sender, EventArgs e)
        {
            try
            {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string appFile = Path.Combine(appDir, AppFileName);
                if (!File.Exists(appFile))
                {
                    Fail(3, "The app's main file is missing. Please install Monteith Holiday Manager again.");
                    return;
                }
                Directory.CreateDirectory(_dataDir);
                var options = new CoreWebView2EnvironmentOptions { Language = "en-GB" };
                var env = await CoreWebView2Environment.CreateAsync(null, _dataDir, options);
                await _web.EnsureCoreWebView2Async(env);
                var core = _web.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsZoomControlEnabled = true;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.IsGeneralAutofillEnabled = false;
                await core.AddScriptToExecuteOnDocumentCreatedAsync(
                    "window.__monteithHost = { version: '" + Application.ProductVersion + "' };");
                core.SetVirtualHostNameToFolderMapping(VirtualHost, appDir, CoreWebView2HostResourceAccessKind.Allow);
                core.DocumentTitleChanged += (o, a) => { if (!string.IsNullOrWhiteSpace(core.DocumentTitle)) Text = core.DocumentTitle; };
                core.NewWindowRequested += (o, a) => { a.Handled = true; OpenExternally(a.Uri); };
                core.NavigationStarting += (o, a) =>
                {
                    // Anything that isn't our own page (mailto:, tel:, web links) goes to Windows instead.
                    if (!a.Uri.StartsWith("https://" + VirtualHost + "/", StringComparison.OrdinalIgnoreCase))
                    {
                        a.Cancel = true;
                        OpenExternally(a.Uri);
                    }
                };
                core.NavigationCompleted += OnNavigationCompleted;
                core.ProcessFailed += (o, a) => Fail(5, "Sorry – the app stopped unexpectedly. Please open it again.");
                core.Navigate("https://" + VirtualHost + "/" + Uri.EscapeDataString(AppFileName));
                if (_smoke)
                {
                    _smokeWatchdog = new Timer { Interval = 60000 };
                    _smokeWatchdog.Tick += (o, a) => Fail(4, "Smoke test timed out.");
                    _smokeWatchdog.Start();
                }
            }
            catch (WebView2RuntimeNotFoundException)
            {
                Fail(2, "This app needs the Microsoft Edge WebView2 component, which is normally part of Windows.\n\nPlease run the Monteith Holiday Manager installer again – it adds the component if it is missing.");
            }
            catch (Exception ex)
            {
                Fail(6, "Sorry – the app couldn't start.\n\n" + ex.Message);
            }
        }

        private async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                Fail(7, "Sorry – the app's page couldn't be shown (" + e.WebErrorStatus + "). Please install Monteith Holiday Manager again.");
                return;
            }
            if (!_smoke) return;
            try
            {
                string brand = "";
                for (int i = 0; i < 20 && !brand.Contains("Monteith"); i++)
                {
                    await Task.Delay(500);
                    brand = await _web.CoreWebView2.ExecuteScriptAsync(
                        "(document.querySelector('.sidebar .brand-name, .onboarding .brand-name') || {}).textContent || ''");
                }
                File.WriteAllText(Path.Combine(_dataDir, "smoke-test.txt"), brand);
                ExitCode = brand.Contains("Monteith") ? 0 : 1;
            }
            catch (Exception ex)
            {
                File.WriteAllText(Path.Combine(_dataDir, "smoke-test.txt"), ex.ToString());
                ExitCode = 8;
            }
            _closingChecked = true;
            Close();
        }

        private static void OpenExternally(string uri)
        {
            if (string.IsNullOrEmpty(uri)) return;
            if (uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || uri.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                || uri.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase) || uri.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
            {
                try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); } catch { /* ignore */ }
            }
        }

        private void Fail(int code, string message)
        {
            ExitCode = code;
            if (!_smoke) MessageBox.Show(this, message, "Monteith Holiday Manager", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            else File.WriteAllText(Path.Combine(_dataDir, "smoke-test.txt"), message);
            _closingChecked = true;
            Close();
        }

        /// <summary>Give the app a moment to finish saving before the window disappears.</summary>
        private async void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            SaveWindowBounds();
            if (_closingChecked || _web.CoreWebView2 == null) return;
            e.Cancel = true;
            try
            {
                for (int i = 0; i < 10; i++)
                {
                    string saved = await _web.CoreWebView2.ExecuteScriptAsync(
                        "(function(){var s=document.querySelector('.save-indicator');return !s || s.classList.contains('saved');})()");
                    if (saved == "true") break;
                    await Task.Delay(150);
                }
            }
            catch { /* close anyway */ }
            _closingChecked = true;
            Close();
        }

        private string BoundsFile => Path.Combine(_dataDir, "window.txt");

        private void RestoreWindowBounds()
        {
            try
            {
                if (!File.Exists(BoundsFile)) return;
                var parts = File.ReadAllText(BoundsFile).Split(',');
                if (parts.Length < 5) return;
                var rect = new Rectangle(int.Parse(parts[0]), int.Parse(parts[1]), int.Parse(parts[2]), int.Parse(parts[3]));
                if (Screen.AllScreens.Length > 0 && Array.Exists(Screen.AllScreens, s => s.WorkingArea.IntersectsWith(rect)))
                {
                    StartPosition = FormStartPosition.Manual;
                    Bounds = rect;
                }
                if (parts[4] == "max") WindowState = FormWindowState.Maximized;
            }
            catch { /* use defaults */ }
        }

        private void SaveWindowBounds()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                Directory.CreateDirectory(_dataDir);
                File.WriteAllText(BoundsFile, string.Join(",", r.X, r.Y, r.Width, r.Height, WindowState == FormWindowState.Maximized ? "max" : "normal"));
            }
            catch { /* not important */ }
        }
    }
}
