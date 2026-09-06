import re

def clean_ocr_digits(text: str) -> str:
    # First replace characters often confused with 1 when between/near digits
    # e.g. '3{2' -> '312', '30{' -> '301', '2{70' -> '2170'
    t = text
    # Replace bracket/pipe/letter variants that represent 1
    t = re.sub(r'[\{\}\[\]\(\)\|!lI]', '1', t)
    # Replace O/o with 0 if near digits
    t = re.sub(r'(?<=\d)[Oo](?=\d)|(?<=\d)[Oo]$|^[Oo](?=\d)', '0', t)
    # Convert Arabic-Indic digits to Western
    arabic_map = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
    t = t.translate(arabic_map)
    # Extract clean digits
    digits = re.sub(r'[^\d]', '', t)
    return digits

tests = ["2{70", "30{", "3{2", "٣٢", "316", "302", "315", "312", "التباعد 15", "ت5", "ت 13"]
for test in tests:
    res = clean_ocr_digits(test)
    print(f"'{test:12s}' -> '{res}'")
