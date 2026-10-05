
import sys
import codecs

content = ''
try:
    with codecs.open('voice-validation.log', 'r', 'utf-8') as f:
        content = f.read()
except UnicodeError:
    with codecs.open('voice-validation.log', 'r', 'utf-16le') as f:
        content = f.read()

import json
blocks = content.split('[Biometric Verification]')
for b in blocks[1:]:
    print('--- EVENT ---')
    print(b[:1000])
