export function Name() { return "MCHOSE Ace 68 Air-III Low-Latency"; }
export function VendorId() { return 0x41E4; }
export function ProductId() { return 0x2132; }
export function Publisher() { return "Community"; }
export function DefaultPosition() { return [10, 10]; }
export function DefaultScale() { return 5.0; }
export function DeviceType() { return "Keyboard"; }
export function LedNames() { return vKeyNames; }
export function LedPositions() { return vKeyPositions; }
export function Size() { return [16, 5]; }

export function ControllableParameters() {
    return [
        {"property":"LightingMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
        {"property":"forcedColor", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"009bde"},
        {"property":"shutdownColor", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"000000"},
        {"property":"isMappingMode", "label":"[Debug] Mapping Mode", "type":"boolean", "default":"false"},
        {"property":"testLedIndex", "label":"[Debug] LED Scanner", "min":"0", "max":"127", "type":"number", "default":"0"}
    ];
}

const vKeyNames = [
    "Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-_", "=+", "Backspace", "Ins",
    "Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "Del",
    "CapsLock", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter", "PgUp",
    "Left Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Right Shift", "Up Arrow", "PgDn",
    "Left Ctrl", "Left Win", "Left Alt", "Space", "Right Alt", "Fn", "Right Ctrl", "Left Arrow", "Down Arrow", "Right Arrow"
];

const vKeys = [
    26, 64, 22, 2, 60, 38, 78, 76, 27, 67, 65, 5, 28, 8, 55,
    66, 4, 83, 0, 40, 18, 16, 47, 7, 25, 45, 68, 48, 30, 70,
    46, 81, 80, 82, 58, 36, 56, 3, 41, 12, 52, 72, 34, 10,
    6, 44, 49, 29, 9, 69, 43, 23, 21, 1, 32, 54, 53, 50,
    11, 71, 31, 63, 61, 14, 74, 33, 73, 13
];

const vKeyPositions = [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [15, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1], [12, 1], [13, 1], [15, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [15, 2],
    [0, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [14, 3], [15, 3],
    [0, 4], [1, 4], [2, 4], [6, 4], [10, 4], [11, 4], [12, 4], [13, 4], [14, 4], [15, 4]
];

// 优化：精简缓冲区大小至 270 字节（5个包的容量：5 * 54）
var globalColorBuffer = new Array(270);
var globalPacket = new Array(65);
for(let i = 0; i < 270; i++) globalColorBuffer[i] = 0;
for(let i = 0; i < 65; i++) globalPacket[i] = 0;

export function Initialize() {
    device.log("MCHOSE Ace 68 Air-III Low-Latency Edition Loaded");
}

export function Validate(endpoint) {
    return endpoint.interface === 1;
}

function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    let colors = [];
    colors[0] = parseInt(result[1], 16);
    colors[1] = parseInt(result[2], 16);
    colors[2] = parseInt(result[3], 16);
    return colors;
}

export function Render() {
    sendColors(false);
}

export function Shutdown() {
    sendColors(true);
}

function sendColors(isShutdown) {
    for(let c = 0; c < 270; c++) globalColorBuffer[c] = 0;
    
    if (isMappingMode) {
        let hwIndex = Math.floor(testLedIndex) * 3;
        if (hwIndex < 267) {
            globalColorBuffer[hwIndex]     = 0xFF;
            globalColorBuffer[hwIndex + 1] = 0x00;
            globalColorBuffer[hwIndex + 2] = 0x00;
        }
    } 
    else {
        for (let i = 0; i < vKeys.length; i++) {
            let col = [0, 0, 0];
            
            if (isShutdown) {
                col = hexToRgb(shutdownColor);
            } else if (LightingMode === "Forced") {
                col = hexToRgb(forcedColor);
            } else {
                let x = vKeyPositions[i][0];
                let y = vKeyPositions[i][1];
                col = device.color(x, y); 
            }

            let bufferIndex = vKeys[i] * 3;
            
            if (bufferIndex < 267) {
                globalColorBuffer[bufferIndex]     = col[0];
                globalColorBuffer[bufferIndex + 1] = col[1];
                globalColorBuffer[bufferIndex + 2] = col[2];
            }
        }
    }

    // 🎯 精准控包：只跑 5 次循环，大幅度降低通信耗时
    for (let i = 0; i < 5; i++) {
        let offset = i * 54;
        
        for(let p = 0; p < 65; p++) globalPacket[p] = 0; 
        
        globalPacket[0] = 0x00;
        globalPacket[1] = 0x55; 
        globalPacket[2] = 0xDD;
        globalPacket[3] = 0x00;
        
        globalPacket[5] = 0x36; 
        globalPacket[6] = offset & 0xFF;
        globalPacket[7] = (offset >> 8) & 0xFF;
        globalPacket[8] = 0x00;

        for (let j = 0; j < 54; j++) {
            globalPacket[9 + j] = globalColorBuffer[offset + j];
        }

        let checksum = 0;
        for (let c = 5; c < 65; c++) {
            checksum += globalPacket[c];
        }
        globalPacket[4] = checksum & 0xFF;

        device.write(globalPacket, 65);
        device.pause(1); 
    }
}