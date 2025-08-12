// ascii.js
(function(){
    const ASCII_CHARS = " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  
    window.AsciiHelper = {
      pixelsToASCII(buffer, cols, rows) {
        let out = '';
        for(let y = 0; y < rows; y++){
          const readY = rows - 1 - y; // invert Y for correct orientation
          for(let x = 0; x < cols; x++){
            const idx = (readY * cols + x) * 4;
            const r = buffer[idx], g = buffer[idx + 1], b = buffer[idx + 2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const norm = lum / 255;
            const charIndex = Math.floor(norm * (ASCII_CHARS.length - 1));
            out += ASCII_CHARS.charAt(charIndex);
          }
          out += '\n';
        }
        return out;
      }
    };
  })();
  