import glob
import re

html_files = glob.glob('src/app/features/**/*.component.html', recursive=True)

for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    
    # We want to replace the newly added icon and just leave `<span>Logout</span>`
    if 'nzType="logout"' in content:
        content = re.sub(
            r'<span nz-icon nzType="logout"></span>\s*',
            r'',
            content
        )
        with open(file, 'w') as f:
            f.write(content)
        print(f"Removed icon from {file}")
