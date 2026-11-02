import Cocoa
import WebKit

private let webPort = 33117
private let runnerPort = 33118

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var processes: [Process] = []
    private var launchAttempts = 0
    private let runnerToken = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        + UUID().uuidString.replacingOccurrences(of: "-", with: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        configureMenu()
        configureWindow()
        startLocalServices()
    }

    func applicationWillTerminate(_ notification: Notification) {
        for process in processes.reversed() {
            guard process.isRunning else { continue }
            let children = Process()
            children.executableURL = URL(fileURLWithPath: "/usr/bin/pkill")
            children.arguments = ["-TERM", "-P", String(process.processIdentifier)]
            try? children.run()
            children.waitUntilExit()
            process.terminate()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func configureMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "HASHCORE X 정보", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "HASHCORE X 종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        NSApp.mainMenu = mainMenu
    }

    private func configureWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "HASHCORE X"
        window.titlebarAppearsTransparent = true
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(red: 0.015, green: 0.025, blue: 0.035, alpha: 1)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("HASHCOREXMainWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        showStatus("INITIALIZING LOCAL CORE", detail: "Hashcat 엔진과 보안 Runner를 시작하고 있습니다.")
    }

    private func startLocalServices() {
        guard
            let projectPath = Bundle.main.object(forInfoDictionaryKey: "HashCoreProjectPath") as? String,
            FileManager.default.fileExists(atPath: projectPath + "/package.json")
        else {
            showStatus("PROJECT CORE NOT FOUND", detail: "앱을 다시 빌드해 프로젝트 경로를 연결해 주세요.")
            return
        }

        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
        environment["HASHCAT_BINARY"] = "/usr/local/bin/hashcat"
        environment["HASHCAT_RUNNER_TOKEN"] = runnerToken
        environment["HASHCAT_RUNNER_PORT"] = String(runnerPort)
        environment["HASHCAT_RUNNER_ALLOWED_ORIGINS"] = "http://127.0.0.1:\(webPort)"

        do {
            processes.append(try launch(
                arguments: ["run", "runner"],
                directory: projectPath,
                environment: environment
            ))
            processes.append(try launch(
                arguments: ["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(webPort)],
                directory: projectPath,
                environment: environment
            ))
            waitForWebServer()
        } catch {
            showStatus("LOCAL CORE FAILED", detail: error.localizedDescription)
        }
    }

    private func launch(arguments: [String], directory: String, environment: [String: String]) throws -> Process {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/pnpm")
        process.arguments = arguments
        process.currentDirectoryURL = URL(fileURLWithPath: directory, isDirectory: true)
        process.environment = environment
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        return process
    }

    private func waitForWebServer() {
        launchAttempts += 1
        guard launchAttempts <= 60 else {
            showStatus("LOCAL CORE TIMEOUT", detail: "로컬 서비스가 30초 안에 준비되지 않았습니다.")
            return
        }

        let probe = URL(string: "http://127.0.0.1:\(webPort)/runner")!
        URLSession.shared.dataTask(with: probe) { [weak self] _, response, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if (response as? HTTPURLResponse)?.statusCode == 200 {
                    self.loadWorkbench()
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.waitForWebServer() }
                }
            }
        }.resume()
    }

    private func loadWorkbench() {
        var fragment = URLComponents()
        fragment.queryItems = [
            URLQueryItem(name: "token", value: runnerToken),
            URLQueryItem(name: "runner", value: "http://127.0.0.1:\(runnerPort)"),
        ]
        let url = URL(string: "http://127.0.0.1:\(webPort)/runner#\(fragment.percentEncodedQuery ?? "")")!
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func showStatus(_ title: String, detail: String) {
        let html = """
        <!doctype html><meta charset="utf-8"><style>
        html,body{height:100%;margin:0;background:#03070a;color:#d9faff;font-family:Menlo,monospace}
        main{height:100%;display:grid;place-content:center;text-align:center;background:radial-gradient(circle,#092b35 0,#03070a 52%)}
        b{font-size:28px;letter-spacing:.18em;color:#23e8ff;text-shadow:0 0 24px #00bcd4}p{color:#7f9da5}
        i{display:block;width:220px;height:2px;margin:26px auto;background:linear-gradient(90deg,transparent,#23e8ff,#ff315b,transparent);animation:p 1.2s infinite}
        @keyframes p{50%{opacity:.25;transform:scaleX(.55)}}
        </style><main><div><b>\(title)</b><i></i><p>\(detail)</p></div></main>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.host == "127.0.0.1" && url.port == webPort || url.scheme == "about" {
            decisionHandler(.allow)
        } else {
            if navigationAction.navigationType == .linkActivated { NSWorkspace.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.run()
