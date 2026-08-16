const { cmd } = require('../ahmad-core');

cmd({
    pattern: 'bmicalculator',
    desc: 'Calculate Body Mass Index',
    category: 'tools',
    react: '⚖️',
    use: '.bmi <weight in kg> <height in cm>'
}, async (conn, mek, m, { reply, args }) => {
    const weight = parseFloat(args[0]);
    const heightCm = parseFloat(args[1]);
    if (!weight || !heightCm) return reply('❌ Use: .bmi <weight in kg> <height in cm>\nExample: .bmi 70 175');
    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);
    let category;
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi < 25) category = 'Normal weight';
    else if (bmi < 30) category = 'Overweight';
    else category = 'Obese';
    reply(`⚖️ *BMI Calculator*\n\nWeight: ${weight}kg\nHeight: ${heightCm}cm\nBMI: *${bmi.toFixed(1)}*\nCategory: *${category}*\n\n_Note: BMI is a rough general indicator, not a full medical assessment._`);
});

cmd({
    pattern: 'agecalculator',
    desc: 'Calculate age from date of birth',
    category: 'tools',
    react: '🎂',
    use: '.agecalculator DD-MM-YYYY'
}, async (conn, mek, m, { reply, args }) => {
    const input = args[0];
    if (!input || !/^\d{1,2}-\d{1,2}-\d{4}$/.test(input)) return reply('❌ Use: .agecalculator DD-MM-YYYY\nExample: .agecalculator 15-08-2000');
    const [d, mo, y] = input.split('-').map(Number);
    const dob = new Date(y, mo - 1, d);
    if (isNaN(dob.getTime()) || dob > new Date()) return reply('❌ Invalid date.');
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    let days = now.getDate() - dob.getDate();
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    reply(`🎂 *Age Calculator*\n\nDate of Birth: ${input}\nAge: *${years} years, ${months} months, ${days} days*`);
});

cmd({
    pattern: 'lovetest',
    desc: 'Fun love compatibility test between two names',
    category: 'fun',
    react: '💕',
    use: '.lovetest <name1> <name2>'
}, async (conn, mek, m, { reply, args }) => {
    if (args.length < 2) return reply('❌ Use: .lovetest <name1> <name2>\nExample: .lovetest Ahmad Sara');
    const [a, b] = args;
    // Deterministic "fun" percentage from the two names, same pair always
    // gives the same result (not truly random each time).
    let seed = 0;
    for (const ch of (a + b).toLowerCase()) seed += ch.charCodeAt(0);
    const percent = seed % 101;
    const bar = '💖'.repeat(Math.round(percent / 10)) + '🖤'.repeat(10 - Math.round(percent / 10));
    reply(`💕 *Love Test*\n\n${a} 💘 ${b}\n\n${bar}\n\n*${percent}% Compatible!*\n\n_Just for fun — not a real prediction 😄_`);
});

cmd({
    pattern: 'shipcalculator',
    desc: 'Fun "ship name" generator for two names',
    category: 'fun',
    react: '🚢',
    use: '.shipcalculator <name1> <name2>'
}, async (conn, mek, m, { reply, args }) => {
    if (args.length < 2) return reply('❌ Use: .shipcalculator <name1> <name2>');
    const [a, b] = args;
    const shipName = a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2));
    reply(`🚢 *Ship Name*\n\n${a} + ${b} = *${shipName}*`);
});

cmd({
    pattern: 'primecheck',
    desc: 'Check if a number is prime',
    category: 'tools',
    react: '🔢',
    use: '.primecheck <number>'
}, async (conn, mek, m, { reply, args }) => {
    const n = parseInt(args[0], 10);
    if (isNaN(n)) return reply('❌ Use: .primecheck <number>');
    if (n < 2) return reply(`🔢 *${n}* is *not prime*.`);
    let isPrime = true;
    for (let i = 2; i * i <= n; i++) {
        if (n % i === 0) { isPrime = false; break; }
    }
    reply(`🔢 *${n}* is *${isPrime ? 'prime ✅' : 'not prime ❌'}*.`);
});

cmd({
    pattern: 'fibonacciseq',
    desc: 'Generate the first N Fibonacci numbers',
    category: 'tools',
    react: '🔢',
    use: '.fibonacciseq <count>'
}, async (conn, mek, m, { reply, args }) => {
    const count = parseInt(args[0], 10);
    if (isNaN(count) || count < 1 || count > 50) return reply('❌ Use: .fibonacciseq <count 1-50>');
    const seq = [0, 1];
    for (let i = 2; i < count; i++) seq.push(seq[i - 1] + seq[i - 2]);
    reply(`🔢 *Fibonacci Sequence (${count})*\n\n${seq.slice(0, count).join(', ')}`);
});

cmd({
    pattern: 'gcdlcm',
    desc: 'Find GCD and LCM of two numbers',
    category: 'tools',
    react: '🔢',
    use: '.gcdlcm <num1> <num2>'
}, async (conn, mek, m, { reply, args }) => {
    const a = parseInt(args[0], 10), b = parseInt(args[1], 10);
    if (isNaN(a) || isNaN(b)) return reply('❌ Use: .gcdlcm <num1> <num2>');
    const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
    const g = gcd(Math.abs(a), Math.abs(b));
    const l = Math.abs(a * b) / (g || 1);
    reply(`🔢 *GCD & LCM*\n\nGCD(${a}, ${b}) = *${g}*\nLCM(${a}, ${b}) = *${l}*`);
});

cmd({
    pattern: 'palindromecheck',
    desc: 'Check if text is a palindrome',
    category: 'tools',
    react: '🔁',
    use: '.palindromecheck <text>'
}, async (conn, mek, m, { reply, text, args }) => {
    const input = (text || args.join(' ')).trim();
    if (!input) return reply('❌ Use: .palindromecheck <text>');
    const clean = input.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPalindrome = clean === clean.split('').reverse().join('');
    reply(`🔁 *Palindrome Check*\n\n"${input}" is *${isPalindrome ? 'a palindrome ✅' : 'not a palindrome ❌'}*.`);
});
