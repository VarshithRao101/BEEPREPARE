import os, glob, re

target_dir = r'd:\TRNT BEE\TRNT BEE\BEEPREPARE\BEEPREPARE-main\beginners'
files = glob.glob(os.path.join(target_dir, '**', '*.html'), recursive=True)
count = 0

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content, num_subs = re.subn(r'(</nav>\s*)<div[^>]*margin-top:\s*auto[^>]*>[\s\S]*?(?=\s*</aside>)', r'\1', content)
    
    if num_subs > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {os.path.basename(file_path)}')
        count += 1

print(f'{count} files updated.')
