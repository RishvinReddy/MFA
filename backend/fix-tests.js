const fs = require('fs');

const files = [
    'tests/phase8a.test.ts'
];

for (let file of files) {
    let c = fs.readFileSync(file, 'utf8');
    
    // First, verify we haven't already replaced it
    if (c.includes("typeof describe !== 'undefined'")) {
        console.log(`Already fixed ${file}`);
        continue;
    }

    // Try to find the function name that is run at the bottom
    let fnMatch = c.match(/run[\w]+Tests/);
    if (!fnMatch) {
        fnMatch = c.match(/runTests/);
    }

    if (fnMatch) {
        let fnName = fnMatch[0];
        let regex = new RegExp(fnName + '\\(\\)\\.catch\\([^}]+\\}\\);', 's');
        
        const replacement = `if (typeof describe !== 'undefined') {
    describe('${file} Legacy Suite', () => {
        it('executes without crashing', async () => {
            await ${fnName}();
        }, 30000);
    });
} else {
    ${fnName}().catch(err => {
        console.error('Failed', err);
        throw err;
    });
}`;
        
        if (regex.test(c)) {
            c = c.replace(regex, replacement);
            fs.writeFileSync(file, c);
            console.log('Fixed ' + file);
        } else {
            console.log('Could not match regex in ' + file);
        }
    } else {
        console.log('Could not find run method in ' + file);
    }
}
