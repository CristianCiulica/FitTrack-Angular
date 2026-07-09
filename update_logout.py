import glob
import os

html_files = glob.glob('src/app/features/**/*.component.html', recursive=True)

old_html = """<li nz-menu-item class="sidebar-logout-item" (click)="logout()">
          <a aria-label="Logout">
            <span>Logout</span>
          </a>
        </li>"""

new_html = """<li nz-menu-item class="sidebar-logout-item" (click)="logout()">
          <a aria-label="Logout">
            <span nz-icon nzType="logout"></span>
            <span>Logout</span>
          </a>
        </li>"""

for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    
    if old_html in content:
        content = content.replace(old_html, new_html)
        with open(file, 'w') as f:
            f.write(content)
        print(f"Updated {file}")
