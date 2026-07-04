#!/usr/bin/env python3
"""Local dev server with extensionless HTML URLs, like GitHub Pages."""

import http.server
import os
import socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path not in ("/", "") and not os.path.splitext(path)[1]:
            html_path = path.lstrip("/") + ".html"
            if os.path.isfile(html_path):
                suffix = self.path[len(path):]
                self.path = "/" + html_path + suffix
        return super().do_GET()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"Serving at http://localhost:{port}/")
        httpd.serve_forever()
