import json
import re

def extract_zepto_json(html_path):
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all self.__next_f.push calls
    pushes = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', content)
    
    # Join them and unescape
    full_data = "".join(pushes).replace('\\"', '"').replace('\\\\', '\\')
    
    # Try to find the product info part
    # Look for "highlights" or "information"
    print(f"Total pushes found: {len(pushes)}")
    
    # Look for the specific sections
    highlights_match = re.search(r'"highlights":\[(.*?)\],', full_data)
    if highlights_match:
        print("Found highlights!")
        # print(highlights_match.group(0)[:500])
    
    info_match = re.search(r'"information":\[(.*?)\],', full_data)
    if info_match:
        print("Found information!")
        # print(info_match.group(0)[:500])

if __name__ == "__main__":
    extract_zepto_json("zepto_product_page.html")
