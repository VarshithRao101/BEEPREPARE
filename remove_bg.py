from PIL import Image
import os

def remove_white_bg(input_path):
    print(f"Processing {input_path}...")
    if not os.path.exists(input_path):
        print("File not found!")
        return

    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()

        newData = []
        for item in datas:
            # Check if pixel is white-ish (allow some tolerance)
            # Standard white is 255, 255, 255
            # Let's say anything brighter than 230
            if item[0] > 230 and item[1] > 230 and item[2] > 230:
                newData.append((255, 255, 255, 0))  # Transparent
            else:
                newData.append(item)

        img.putdata(newData)
        img.save(input_path, "PNG")
        print(f"Successfully removed white background from {input_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_white_bg(r"d:\TRNT BEE\TRNT BEE\BEEPREPARE\project-root\assets\custom-bee.png")
