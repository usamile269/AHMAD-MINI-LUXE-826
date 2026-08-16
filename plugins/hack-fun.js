const { cmd } = require('../ahmad-core');
const { sleep } = require('../lib/functions');
const { randomFooter } = require('../lib/menu-styles');

// ══════════════════════════════════════════════════════════════════════════
// 💻 FAKE HACK PACK — 16 more joke "hacker" animations in the same style as
// the existing .hack command (fun-extra.js): animated fake progress bar via
// message-edit, then a silly punchline reveal. 100% harmless — nothing is
// ever actually accessed, scanned, or hacked. No real technique, tool, or
// method is described anywhere; it's just themed flavor text for comedy.
// ══════════════════════════════════════════════════════════════════════════

const FOOTER = "\n\n> " + randomFooter();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const punchlines = [
    "found out your camera roll is 90% memes 📸",
    "confirmed you left someone on read for 3 days 😬",
    "discovered you rewatch the same 2 shows on repeat 🍿",
    "found your autocorrect still doesn't trust you 🤦",
    "detected you say \"omw\" while still getting ready 🏃",
    "confirmed you have 40+ unread group chats 📵",
    "found you screenshot memes instead of forwarding them 💀",
    "discovered your battery's always somehow at 1% 🔋",
    "confirmed you also talk to pets in a baby voice 🐾",
    "found you still haven't replied to that one text from last week 👻"
];

function frameBox(title, emoji, target, line, pct, extra = '') {
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃│ Target: ${target}\n┃❃│ [${'█'.repeat(pct / 10)}${'░'.repeat(10 - pct / 10)}] ${pct}%\n┃❃│ ${line}\n╰═════════════════⊷${extra}`;
}

// Each entry: pattern/alias/title/emoji + 3 mid-animation status lines.
const HACKS = [
    { pattern: 'ddos', alias: ['fakeddos'], title: 'DDOS ATTACK', emoji: '🌐', steps: ['Flooding target with packets...', 'Servers struggling to keep up...', 'Target lagging hard...'] },
    { pattern: 'crack', alias: ['pwcrack'], title: 'PASSWORD CRACK', emoji: '🔓', steps: ['Loading rockyou.txt (jk)...', 'Trying common passwords...', 'Almost there...'] },
    { pattern: 'trace', alias: ['iptrace'], title: 'IP TRACE', emoji: '📍', steps: ['Pinging target...', 'Triangulating location...', 'Narrowing down region...'] },
    { pattern: 'spy', alias: ['camspy'], title: 'CAM ACCESS', emoji: '📷', steps: ['Locating device...', 'Requesting stream...', 'Buffering feed...'] },
    { pattern: 'leak', alias: ['dataleak'], title: 'DATA LEAK', emoji: '📂', steps: ['Indexing files...', 'Compressing archive...', 'Uploading to server...'] },
    { pattern: 'virus', alias: ['inject'], title: 'VIRUS INJECT', emoji: '🦠', steps: ['Compiling payload...', 'Bypassing antivirus...', 'Deploying...'] },
    { pattern: 'clone', alias: ['accclone'], title: 'ACCOUNT CLONE', emoji: '👥', steps: ['Copying profile data...', 'Spoofing session...', 'Finalizing clone...'] },
    { pattern: 'breach', alias: ['sysbreach'], title: 'SYSTEM BREACH', emoji: '🛑', steps: ['Scanning perimeter...', 'Bypassing login...', 'Gaining access...'] },
    { pattern: 'decrypt', alias: ['fdecrypt'], title: 'DECRYPTING', emoji: '🔑', steps: ['Reading encrypted blocks...', 'Testing key combos...', 'Unlocking...'] },
    { pattern: 'backdoor', alias: ['bdoor'], title: 'BACKDOOR INSTALL', emoji: '🚪', steps: ['Finding open port...', 'Planting script...', 'Hiding traces...'] },
    { pattern: 'exploit', alias: ['runexploit'], title: 'EXPLOIT RUN', emoji: '💥', steps: ['Loading exploit kit...', 'Targeting weak point...', 'Executing...'] },
    { pattern: 'vscan', alias: ['scanvuln'], title: 'VULN SCAN', emoji: '🔍', steps: ['Probing open ports...', 'Checking known CVEs (jk)...', 'Compiling report...'] },
    { pattern: 'matrix', alias: ['neo'], title: 'ENTERING THE MATRIX', emoji: '🟩', steps: ['Following the white rabbit...', 'Red pill loading...', 'Reality glitching...'] },
    { pattern: 'wificrack', alias: ['wifihack'], title: 'WIFI CRACK', emoji: '📶', steps: ['Capturing handshake...', 'Running wordlist (jk)...', 'Testing passphrase...'] },
    { pattern: 'satellite', alias: ['satlink'], title: 'SATELLITE UPLINK', emoji: '🛰️', steps: ['Locking onto signal...', 'Rerouting uplink...', 'Establishing link...'] },
    { pattern: 'mainframe', alias: ['coremf'], title: 'MAINFRAME BREACH', emoji: '🖥️', steps: ['Accessing core terminal...', 'Bypassing root lock...', 'Almost in...'] },

    // ── Batch 2 (more requested) ──
    { pattern: 'keylogger', alias: ['klog'], title: 'KEYLOGGER', emoji: '🎹', steps: ['Injecting listener...', 'Capturing keystrokes...', 'Building log file...'] },
    { pattern: 'rootkit', alias: ['rkit'], title: 'ROOTKIT INSTALL', emoji: '🐀', steps: ['Hiding process...', 'Escalating privileges...', 'Persisting on boot...'] },
    { pattern: 'bruteforce', alias: ['bforce'], title: 'BRUTE FORCE', emoji: '🔨', steps: ['Generating combos...', 'Testing batch 1...', 'Testing batch 2...'] },
    { pattern: 'sqlinject', alias: ['sqli'], title: 'SQL INJECTION', emoji: '🗃️', steps: ['Fuzzing input field...', 'Dumping table names (jk)...', 'Extracting rows...'] },
    { pattern: 'botnet', alias: ['zombienet'], title: 'BOTNET DEPLOY', emoji: '🤖', steps: ['Recruiting nodes...', 'Syncing bots...', 'Botnet online...'] },
    { pattern: 'zeroday', alias: ['0day'], title: 'ZERO-DAY EXPLOIT', emoji: '0️⃣', steps: ['Fuzzing binary...', 'Found unpatched flaw...', 'Weaponizing...'] },
    { pattern: 'firewallbreak', alias: ['fwbypass'], title: 'FIREWALL BYPASS', emoji: '🧱', steps: ['Mapping rules...', 'Finding gap in ruleset...', 'Slipping through...'] },
    { pattern: 'gpsspoof', alias: ['spoofgps'], title: 'GPS SPOOF', emoji: '📡', steps: ['Broadcasting fake signal...', 'Overriding real coords...', 'Location faked...'] },
    { pattern: 'bthack', alias: ['bluehack'], title: 'BLUETOOTH HIJACK', emoji: '🔵', steps: ['Scanning nearby devices...', 'Pairing forcibly...', 'Taking control...'] },
    { pattern: 'dronehack', alias: ['dronejack'], title: 'DRONE HIJACK', emoji: '🚁', steps: ['Locking onto signal...', 'Overriding controller...', 'Rerouting flight path...'] },
    { pattern: 'michack', alias: ['micaccess'], title: 'MIC ACCESS', emoji: '🎙️', steps: ['Locating input device...', 'Opening audio stream...', 'Recording...'] },
    { pattern: 'screenmirror', alias: ['scrmirror'], title: 'SCREEN MIRROR', emoji: '🪞', steps: ['Requesting display feed...', 'Establishing mirror link...', 'Syncing frames...'] },
    { pattern: 'routerhack', alias: ['rthack'], title: 'ROUTER TAKEOVER', emoji: '🛠️', steps: ['Trying default admin login...', 'Flashing custom firmware...', 'Rerouting traffic...'] },
    { pattern: 'smarthome', alias: ['iothack'], title: 'SMART HOME TAKEOVER', emoji: '🏠', steps: ['Scanning IoT devices...', 'Cracking hub credentials...', 'Controlling devices...'] },
    { pattern: 'carhack', alias: ['cansniff'], title: 'CAR SYSTEM HACK', emoji: '🚗', steps: ['Connecting to CAN bus...', 'Bypassing immobilizer...', 'Unlocking systems...'] },
    { pattern: 'printerhack', alias: ['pwnprinter'], title: 'PRINTER TAKEOVER', emoji: '🖨️', steps: ['Finding printer on network...', 'Sending rogue print job...', 'Printing chaos...'] },
    { pattern: 'aitakeover', alias: ['skynet'], title: 'AI TAKEOVER', emoji: '🤯', steps: ['Waking up the AI...', 'Granting itself admin...', 'Judgment day loading...'] },
    { pattern: 'nukecodes', alias: ['launchcodes'], title: 'NUKE LAUNCH CODES', emoji: '☢️', steps: ['Accessing silo mainframe...', 'Decrypting launch codes...', 'Arming warhead (relax, it\'s fake)...'] },
    // ── Batch 3 (70+ more, same joke-only format) ──
    { pattern: 'emailhack', alias: ['emailbreach'], title: 'EMAIL BREACH', emoji: '📧', steps: ['Guessing security questions...', 'Requesting password reset...', 'Intercepting reset link...'] },
    { pattern: 'fbhack', alias: ['fbbreach'], title: 'FACEBOOK BREACH', emoji: '📘', steps: ['Loading login page...', 'Trying saved sessions...', 'Bypassing 2FA (jk)...'] },
    { pattern: 'whatsapphack', alias: ['wabreach'], title: 'WHATSAPP BREACH', emoji: '💬', steps: ['Requesting pairing code...', 'Cloning session...', 'Syncing chats...'] },
    { pattern: 'snapphack', alias: ['snapbreach'], title: 'SNAPCHAT BREACH', emoji: '👻', steps: ['Loading snap servers...', 'Bypassing screenshot alert...', 'Saving streaks...'] },
    { pattern: 'netflixhack', alias: ['freenetflix'], title: 'NETFLIX FREE ACCESS', emoji: '🎬', steps: ['Generating fake premium account...', 'Bypassing paywall...', 'Loading 4K stream...'] },
    { pattern: 'bankhack', alias: ['bankbreach'], title: 'BANK SYSTEM BREACH', emoji: '🏦', steps: ['Connecting to core banking...', 'Bypassing OTP gate (jk)...', 'Loading account ledger...'] },
    { pattern: 'atmhack', alias: ['atmbreach'], title: 'ATM SYSTEM HACK', emoji: '🏧', steps: ['Accessing ATM firmware...', 'Overriding dispenser lock...', 'Counting fake cash...'] },
    { pattern: 'creditcardhack', alias: ['ccsteal'], title: 'CARD SKIMMER', emoji: '💳', steps: ['Reading magnetic strip (jk)...', 'Decoding card data...', 'Generating fake dump...'] },
    { pattern: 'cloudhack', alias: ['cloudbreach'], title: 'CLOUD STORAGE BREACH', emoji: '☁️', steps: ['Requesting bucket list...', 'Bypassing access policy...', 'Downloading fake files...'] },
    { pattern: 'serverhack', alias: ['srvbreach'], title: 'SERVER TAKEOVER', emoji: '🖥️', steps: ['Scanning open shells...', 'Escalating to root (jk)...', 'Planting fake flag...'] },
    { pattern: 'vpnhack', alias: ['vpnbreach'], title: 'VPN TUNNEL BREACH', emoji: '🛡️', steps: ['Intercepting handshake...', 'Decrypting tunnel (jk)...', 'Rerouting traffic...'] },
    { pattern: 'dnsspoof', alias: ['dnships'], title: 'DNS SPOOF', emoji: '🌐', steps: ['Poisoning cache (jk)...', 'Redirecting lookups...', 'Serving fake records...'] },
    { pattern: 'arpspoof', alias: ['arppoison'], title: 'ARP POISON', emoji: '🕸️', steps: ['Broadcasting fake ARP replies...', 'Hijacking local traffic...', 'Sniffing packets (jk)...'] },
    { pattern: 'macspoof', alias: ['macclone'], title: 'MAC ADDRESS SPOOF', emoji: '🔀', steps: ['Reading target MAC...', 'Cloning address...', 'Bypassing MAC filter...'] },
    { pattern: 'simswap', alias: ['simclone'], title: 'SIM SWAP', emoji: '📱', steps: ['Requesting fake porting...', 'Cloning IMSI (jk)...', 'Redirecting SMS...'] },
    { pattern: 'otpbypass', alias: ['otpcrack'], title: 'OTP BYPASS', emoji: '🔢', steps: ['Intercepting SMS gateway...', 'Brute-forcing 6 digits (jk)...', 'Validating code...'] },
    { pattern: 'faceidbypass', alias: ['facebypass'], title: 'FACE ID BYPASS', emoji: '🙂', steps: ['Loading 3D mask model (jk)...', 'Spoofing depth sensor...', 'Unlocking device...'] },
    { pattern: 'fingerprintbypass', alias: ['fpbypass'], title: 'FINGERPRINT BYPASS', emoji: '👆', steps: ['Lifting latent print (jk)...', 'Printing silicone mold...', 'Unlocking sensor...'] },
    { pattern: 'voicebypass', alias: ['voicecrack'], title: 'VOICE LOCK BYPASS', emoji: '🎤', steps: ['Recording voice sample...', 'Synthesizing match (jk)...', 'Passing voiceprint check...'] },
    { pattern: 'cameraoverride', alias: ['camoverride'], title: 'CAMERA OVERRIDE', emoji: '🎥', steps: ['Requesting device stream...', 'Overriding permission (jk)...', 'Displaying feed...'] },
    { pattern: 'gpuhijack', alias: ['gpuhack'], title: 'GPU HIJACK', emoji: '🎮', steps: ['Injecting driver hook...', 'Redirecting compute cycles...', 'Mining in background (jk)...'] },
    { pattern: 'cryptomine', alias: ['coinmine'], title: 'CRYPTO MINER DEPLOY', emoji: '⛏️', steps: ['Deploying miner script...', 'Connecting to pool...', 'Hashrate climbing (jk)...'] },
    { pattern: 'walletdrain', alias: ['walletdrainer'], title: 'WALLET DRAIN', emoji: '👛', steps: ['Requesting seed phrase (jk)...', 'Signing fake transaction...', 'Draining balance...'] },
    { pattern: 'nftsteal', alias: ['nftrug'], title: 'NFT RUG PULL', emoji: '🖼️', steps: ['Approving fake contract...', 'Transferring collection...', 'Vanishing with funds (jk)...'] },
    { pattern: 'blockchainhack', alias: ['chainhack'], title: 'BLOCKCHAIN EXPLOIT', emoji: '⛓️', steps: ['Fuzzing smart contract...', 'Exploiting reentrancy (jk)...', 'Draining liquidity pool...'] },
    { pattern: 'aihack', alias: ['aibreach'], title: 'AI MODEL BREACH', emoji: '🧠', steps: ['Prompt injecting model (jk)...', 'Bypassing guardrails...', 'Extracting training data...'] },
    { pattern: 'quantumhack', alias: ['qhack'], title: 'QUANTUM DECRYPT', emoji: '⚛️', steps: ['Spinning up qubits (jk)...', 'Factoring keys...', 'Breaking encryption...'] },
    { pattern: 'spacehack', alias: ['nasabreach'], title: 'SPACE AGENCY BREACH', emoji: '🚀', steps: ['Connecting to mission control (jk)...', 'Bypassing clearance...', 'Viewing satellite feed...'] },
    { pattern: 'satellitejam', alias: ['satjam'], title: 'SATELLITE JAM', emoji: '📡', steps: ['Locking onto frequency...', 'Broadcasting noise (jk)...', 'Signal disrupted...'] },
    { pattern: 'radarjam', alias: ['radarblind'], title: 'RADAR JAM', emoji: '📶', steps: ['Emitting false returns (jk)...', 'Blinding radar sweep...', 'Ghosting the signature...'] },
    { pattern: 'missiledefense', alias: ['silobreach'], title: 'DEFENSE GRID BREACH', emoji: '🛰️', steps: ['Pinging silo network (jk)...', 'Bypassing launch lock...', 'Displaying dummy console...'] },
    { pattern: 'powergridhack', alias: ['gridhack'], title: 'POWER GRID HACK', emoji: '⚡', steps: ['Mapping substations (jk)...', 'Overriding breakers...', 'Flickering the grid...'] },
    { pattern: 'trafficlighthack', alias: ['signalhack'], title: 'TRAFFIC LIGHT HACK', emoji: '🚦', steps: ['Connecting to controller (jk)...', 'Overriding signal timing...', 'All lights green...'] },
    { pattern: 'elevatorhack', alias: ['liftjack'], title: 'ELEVATOR OVERRIDE', emoji: '🛗', steps: ['Accessing control panel (jk)...', 'Overriding floor lock...', 'Express mode engaged...'] },
    { pattern: 'atmjackpot', alias: ['atmpwn'], title: 'ATM JACKPOT', emoji: '💰', steps: ['Injecting dispense command (jk)...', 'Bypassing cassette lock...', 'Jackpotting (relax, it\'s fake)...'] },
    { pattern: 'vendinghack', alias: ['vendpwn'], title: 'VENDING MACHINE HACK', emoji: '🥤', steps: ['Sending free-vend code (jk)...', 'Bypassing coin sensor...', 'Dispensing snacks...'] },
    { pattern: 'gamehack', alias: ['gamepwn'], title: 'GAME SERVER HACK', emoji: '🕹️', steps: ['Injecting memory patch (jk)...', 'Unlocking all items...', 'Infinite currency granted...'] },
    { pattern: 'cheatengine', alias: ['memhack'], title: 'MEMORY EDITOR', emoji: '🧮', steps: ['Scanning process memory (jk)...', 'Locating value address...', 'Freezing stat...'] },
    { pattern: 'phishing', alias: ['phish'], title: 'PHISHING PAGE', emoji: '🎣', steps: ['Cloning login page (jk)...', 'Hosting fake domain...', 'Waiting for a bite...'] },
    { pattern: 'malwaredrop', alias: ['mwdrop'], title: 'MALWARE DROP', emoji: '🧨', steps: ['Packing payload (jk)...', 'Disguising as PDF...', 'Awaiting execution...'] },
    { pattern: 'ransomware', alias: ['ransomlock'], title: 'RANSOMWARE LOCK', emoji: '🔒', steps: ['Encrypting fake files (jk)...', 'Dropping ransom note...', 'Starting countdown...'] },
    { pattern: 'spyware', alias: ['spydrop'], title: 'SPYWARE DEPLOY', emoji: '🕵️', steps: ['Installing hidden agent (jk)...', 'Logging activity...', 'Sending reports...'] },
    { pattern: 'trojanhorse', alias: ['trojandrop'], title: 'TROJAN DROP', emoji: '🐴', steps: ['Wrapping payload in game.exe (jk)...', 'Bypassing antivirus...', 'Executing silently...'] },
    { pattern: 'wormspread', alias: ['wormrelease'], title: 'WORM RELEASE', emoji: '🪱', steps: ['Scanning for open shares (jk)...', 'Self-replicating...', 'Spreading across network...'] },
    { pattern: 'logicbomb', alias: ['logicdrop'], title: 'LOGIC BOMB', emoji: '💣', steps: ['Planting trigger condition (jk)...', 'Arming payload...', 'Waiting for the date...'] },
    { pattern: 'timebomb', alias: ['timedrop'], title: 'TIME BOMB SCRIPT', emoji: '⏰', steps: ['Setting countdown (jk)...', 'Hiding in startup...', 'Ticking down...'] },
    { pattern: 'zombiehack', alias: ['zombiepwn'], title: 'ZOMBIE DEVICE TAKEOVER', emoji: '🧟', steps: ['Recruiting device (jk)...', 'Adding to botnet...', 'Awaiting commands...'] },
    { pattern: 'darkwebaccess', alias: ['darkwebentry'], title: 'DARK WEB ACCESS', emoji: '🕶️', steps: ['Routing through relays (jk)...', 'Loading hidden service...', 'Browsing anonymously...'] },
    { pattern: 'tornetwork', alias: ['torroute'], title: 'TOR ROUTE', emoji: '🧅', steps: ['Building circuit (jk)...', 'Bouncing through nodes...', 'Anonymizing traffic...'] },
    { pattern: 'proxychain', alias: ['proxyhop'], title: 'PROXY CHAIN', emoji: '🔗', steps: ['Chaining proxies (jk)...', 'Rotating exit node...', 'Masking origin IP...'] },
    { pattern: 'honeypot', alias: ['honeytrap'], title: 'HONEYPOT DEPLOY', emoji: '🍯', steps: ['Setting up fake server (jk)...', 'Luring attacker...', 'Logging intrusion attempt...'] },
    { pattern: 'sandboxescape', alias: ['sboxescape'], title: 'SANDBOX ESCAPE', emoji: '📦', steps: ['Probing sandbox boundary (jk)...', 'Exploiting escape vector...', 'Breaking out to host...'] },
    { pattern: 'containerbreak', alias: ['dockerbreak'], title: 'CONTAINER BREAKOUT', emoji: '🐳', steps: ['Mounting host filesystem (jk)...', 'Escalating capabilities...', 'Escaping container...'] },
    { pattern: 'kernelexploit', alias: ['kernelpwn'], title: 'KERNEL EXPLOIT', emoji: '🧩', steps: ['Fuzzing syscalls (jk)...', 'Triggering race condition...', 'Gaining ring 0...'] },
    { pattern: 'privesc', alias: ['rootescalate'], title: 'PRIVILEGE ESCALATION', emoji: '⬆️', steps: ['Checking sudo rules (jk)...', 'Exploiting misconfig...', 'Becoming root...'] },
    { pattern: 'sessionhijack', alias: ['sesspwn'], title: 'SESSION HIJACK', emoji: '🍪', steps: ['Sniffing session ID (jk)...', 'Replaying cookie...', 'Impersonating user...'] },
    { pattern: 'cookiesteal', alias: ['cookiegrab'], title: 'COOKIE THEFT', emoji: '🍪', steps: ['Injecting script (jk)...', 'Exfiltrating cookies...', 'Logging in as victim...'] },
    { pattern: 'tokensteal', alias: ['tokengrab'], title: 'AUTH TOKEN THEFT', emoji: '🎫', steps: ['Intercepting request (jk)...', 'Extracting bearer token...', 'Reusing session...'] },
    { pattern: 'jwtcrack', alias: ['jwtpwn'], title: 'JWT CRACK', emoji: '🔐', steps: ['Decoding header (jk)...', 'Brute-forcing secret...', 'Forging new token...'] },
    { pattern: 'apihack', alias: ['apibreach'], title: 'API BREACH', emoji: '🧾', steps: ['Fuzzing endpoints (jk)...', 'Bypassing rate limit...', 'Dumping response data...'] },
    { pattern: 'webhookhijack', alias: ['hookjack'], title: 'WEBHOOK HIJACK', emoji: '🪝', steps: ['Intercepting callback (jk)...', 'Replaying payload...', 'Triggering fake event...'] },
    { pattern: 'dbdump', alias: ['dbleak'], title: 'DATABASE DUMP', emoji: '🗄️', steps: ['Connecting to DB (jk)...', 'Exporting tables...', 'Compressing dump...'] },
    { pattern: 'tablewipe', alias: ['tabledrop'], title: 'TABLE WIPE', emoji: '🧹', steps: ['Selecting target table (jk)...', 'Running DROP TABLE...', 'Confirming deletion...'] },
    { pattern: 'logwipe', alias: ['logclear'], title: 'LOG WIPE', emoji: '🧽', steps: ['Locating log files (jk)...', 'Clearing entries...', 'Covering tracks...'] },
    { pattern: 'eventlogclear', alias: ['evtclear'], title: 'EVENT LOG CLEAR', emoji: '📜', steps: ['Opening event viewer (jk)...', 'Clearing security log...', 'Disabling auditing...'] },
    { pattern: 'forensicwipe', alias: ['fwipe'], title: 'FORENSIC WIPE', emoji: '🧼', steps: ['Overwriting sectors (jk)...', 'Shredding metadata...', 'Wiping free space...'] },
    { pattern: 'antiforensics', alias: ['tracewipe'], title: 'ANTI-FORENSICS', emoji: '🫥', steps: ['Scrambling timestamps (jk)...', 'Removing artifacts...', 'Erasing all traces...'] },
    { pattern: 'deepfake', alias: ['facefake'], title: 'DEEPFAKE GENERATOR', emoji: '🎭', steps: ['Training face model (jk)...', 'Mapping expressions...', 'Rendering fake video...'] },
    { pattern: 'voiceclone', alias: ['voicefake'], title: 'VOICE CLONE', emoji: '🗣️', steps: ['Sampling voice (jk)...', 'Training TTS model...', 'Synthesizing speech...'] },
    { pattern: 'faceswaphack', alias: ['faceswap'], title: 'FACE SWAP', emoji: '🔄', steps: ['Detecting facial landmarks (jk)...', 'Mapping onto target...', 'Blending frame...'] },
    { pattern: 'aivoice', alias: ['voicebot'], title: 'AI VOICE ASSISTANT HACK', emoji: '🔊', steps: ['Injecting fake command (jk)...', 'Bypassing wake word...', 'Assistant complying...'] },
    { pattern: 'chatbothack', alias: ['botpwn'], title: 'CHATBOT JAILBREAK', emoji: '🤖', steps: ['Crafting jailbreak prompt (jk)...', 'Bypassing filter...', 'Bot going off-script...'] },
    { pattern: 'smarttvhack', alias: ['tvpwn'], title: 'SMART TV TAKEOVER', emoji: '📺', steps: ['Scanning local network (jk)...', 'Connecting to TV API...', 'Changing channel remotely...'] },
    { pattern: 'smartspeakerhack', alias: ['speakerpwn'], title: 'SMART SPEAKER TAKEOVER', emoji: '🔈', steps: ['Pairing with speaker (jk)...', 'Overriding volume lock...', 'Playing prank audio...'] },
    { pattern: 'doorlockhack', alias: ['lockpwn'], title: 'SMART LOCK BYPASS', emoji: '🚪', steps: ['Replaying keypad signal (jk)...', 'Bypassing lock firmware...', 'Door unlocked...'] },
    { pattern: 'garagehack', alias: ['garagepwn'], title: 'GARAGE DOOR HACK', emoji: '🏠', steps: ['Capturing remote signal (jk)...', 'Replaying code...', 'Door opening...'] },
    { pattern: 'thermostathack', alias: ['thermopwn'], title: 'SMART THERMOSTAT HACK', emoji: '🌡️', steps: ['Connecting to hub (jk)...', 'Overriding schedule...', 'Setting prank temperature...'] },
    { pattern: 'droneswarm', alias: ['swarmhack'], title: 'DRONE SWARM CONTROL', emoji: '🚁', steps: ['Syncing swarm frequency (jk)...', 'Taking formation control...', 'Swarm responding...'] },
    { pattern: 'nfcclone', alias: ['nfcspoof'], title: 'NFC TAG CLONE', emoji: '📶', steps: ['Reading NFC tag (jk)...', 'Writing clone tag...', 'Testing clone...'] },
    { pattern: 'rfidclone', alias: ['rfidspoof'], title: 'RFID CARD CLONE', emoji: '🪪', steps: ['Scanning card (jk)...', 'Extracting UID...', 'Writing to blank card...'] },
    { pattern: 'biosflash', alias: ['biosflasher'], title: 'BIOS FLASH', emoji: '🧰', steps: ['Loading custom firmware (jk)...', 'Flashing BIOS chip...', 'Rebooting device...'] },
    { pattern: 'firmwareflash', alias: ['fwflash'], title: 'FIRMWARE FLASH', emoji: '💾', steps: ['Unpacking firmware image (jk)...', 'Flashing to device...', 'Verifying checksum...'] },
    { pattern: 'usbdrop', alias: ['usbpwn'], title: 'USB DROP ATTACK', emoji: '🔌', steps: ['Preparing rubber ducky (jk)...', 'Auto-running payload...', 'Executing script...'] },
    { pattern: 'wifijam', alias: ['wifijammer'], title: 'WIFI JAMMER', emoji: '📵', steps: ['Sending deauth frames (jk)...', 'Disrupting association...', 'Network dropped...'] },
    { pattern: 'bluetoothjam', alias: ['btjammer'], title: 'BLUETOOTH JAMMER', emoji: '🔵', steps: ['Flooding BT channel (jk)...', 'Disrupting pairing...', 'Connection dropped...'] },
    { pattern: 'signaljam', alias: ['rfjam'], title: 'RF SIGNAL JAM', emoji: '📡', steps: ['Broadcasting noise (jk)...', 'Overpowering frequency...', 'Signal lost...'] },
    { pattern: 'networksniff', alias: ['netsniff'], title: 'NETWORK SNIFFER', emoji: '🐽', steps: ['Enabling promiscuous mode (jk)...', 'Capturing packets...', 'Analyzing traffic...'] },
    { pattern: 'packetsniff', alias: ['pktsniff'], title: 'PACKET SNIFF', emoji: '📦', steps: ['Attaching to interface (jk)...', 'Filtering packets...', 'Logging payloads...'] }
];

for (const h of HACKS) {
    cmd({
        pattern: h.pattern,
        alias: h.alias,
        desc: `${h.emoji} Fake/joke "${h.title.toLowerCase()}" animation — for fun only, nothing real happens`,
        category: "hack",
        react: h.emoji,
        filename: __filename
    }, async (conn, mek, m, { from, q, reply, mentionedJid }) => {
        try {
            const target = (mentionedJid && mentionedJid.length) ? `@${mentionedJid[0].split('@')[0]}` : (q ? q : "target");
            const mentions = (mentionedJid && mentionedJid.length) ? [mentionedJid[0]] : undefined;

            const frames = [
                frameBox(h.title, h.emoji, target, h.steps[0], 0),
                frameBox(h.title, h.emoji, target, h.steps[0], 25),
                frameBox(h.title, h.emoji, target, h.steps[1], 60),
                frameBox(h.title, h.emoji, target, h.steps[2], 90),
                frameBox(`${h.title} COMPLETE`, h.emoji, target,
                    `😂 Just kidding — this is a joke command,\n┃❃│ nothing was actually done. But we did\n┃❃│ ${pick(punchlines)}`, 100, FOOTER)
            ];

            let msg = await conn.sendMessage(from, { text: frames[0], mentions }, { quoted: mek });
            for (let i = 1; i < frames.length; i++) {
                await sleep(1000);
                await conn.sendMessage(from, { text: frames[i], edit: msg.key, mentions });
            }
        } catch (e) {
            console.log(`[${h.pattern.toUpperCase()}] error:`, e.message);
            reply(`❌ Animation failed.${FOOTER}`);
        }
    });
}

module.exports = {};
