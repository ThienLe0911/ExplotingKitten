const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

let startIndex = content.indexOf('<div class="flex overflow-x-auto space-x-2 pb-4 mb-6 scrollbar-hide">');
let endIndex = content.indexOf('<p class="text-[10px] text-zinc-500 italic">Luật chơi: Bạn buộc phải cho 1 lá bài bất kỳ.</p>');

if (startIndex !== -1 && endIndex !== -1) {
    let replacement = `<div class="flex overflow-x-auto space-x-2 pb-4 mb-6 scrollbar-hide">
                                \${myHand.map((c, i) => {
                                    const ct = c.type || c;
                                    const cd = CARD_TYPES[ct];
                                    const innerContent = cd.imageUrl
                                        ? '<img src="' + cd.imageUrl + '" class="absolute inset-0 w-full h-full object-cover">'
                                        : '<div class="w-full h-full p-2 flex flex-col justify-between z-10">' +
                                          '<p class="text-[8px] font-bold uppercase">' + cd.name + '</p>' +
                                          '<div class="text-[12px]">🐈</div>' +
                                          '</div>';
                                    return \`
                                        <button onclick="completeFavor(\\\${i})" class="w-20 h-28 p-0 rounded-lg overflow-hidden relative \\\${cd.color} flex flex-col justify-between text-center shrink-0 border-2 border-white hover:scale-105 transition-transform shadow-lg" title="\\\${cd.name}">
                                            \\\${innerContent}
                                        </button>
                                    \`;
                                }).join('')}
                            </div>
                            `;
    
    // Notice the exact matched substring
    content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
    fs.writeFileSync('index.html', content);
    console.log("Success");
} else {
    console.log("Not found");
}
