import glob
import re

html_files = glob.glob('src/app/features/**/*.component.html', recursive=True)

for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    
    # We want to replace `<a aria-label="Logout">\n            <span>Logout</span>`
    # with `<a aria-label="Logout">\n            <span nz-icon nzType="logout"></span>\n            <span>Logout</span>`
    
    # First check if it already has the icon to avoid duplicates
    if 'nzType="logout"' not in content and 'aria-label="Logout"' in content:
        content = re.sub(
            r'(<a[^>]*aria-label="Logout"[^>]*>\s*)(<span>Logout</span>)',
            r'\1<span nz-icon nzType="logout"></span>\n            \2',
            content
        )
        with open(file, 'w') as f:
            f.write(content)
        print(f"Updated {file}")
