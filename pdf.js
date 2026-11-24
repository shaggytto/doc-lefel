/* Gerador do PDF "Atestado de Execução de Transporte Escolar".
   Escreve o PDF diretamente (sem bibliotecas), com as fontes Carlito embutidas
   (mesmas medidas do Calibri usado no modelo .docx). Medidas em pontos (A4). */
(function () {
  'use strict';
  var A = window.FICHA_ASSETS;
  var PW = 595.28, PH = 841.89;
  var LEFT = 85.05, RIGHT = 510.24, TEXTW = RIGHT - LEFT;

  var EMPRESA = 'LEFEL Transportes';
  var CNPJ = '20.278.695/0001-85';
  var CIDADE = 'Campinas';
  var PERIODOS = {
    manha: { rotulo: 'Manhã', horas: '[8:00 – 12:00]' },
    tarde: { rotulo: 'Tarde', horas: '[13:00 – 17:00]' },
    integral: { rotulo: 'Integral', horas: '[08:00 – 17:00]' }
  };
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /* ---------- texto / codificação WinAnsi (cp1252) ---------- */
  var CP = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95 };
  function bytesOf(s) {
    var out = [];
    for (var ch of String(s)) {
      var c = ch.codePointAt(0);
      out.push(c < 256 ? c : (CP[c] || 63));
    }
    return out;
  }
  var FONTKEY = { F1: 'regular', F2: 'bold' };
  function width(font, s, size) {
    var w = A.fonts[FONTKEY[font]].widths, t = 0, b = bytesOf(s);
    for (var i = 0; i < b.length; i++) t += b[i] >= 32 ? (w[b[i] - 32] || 0) : 0;
    return t * size / 1000;
  }
  function pdfStr(s) {
    var o = '(', b = bytesOf(s);
    for (var i = 0; i < b.length; i++) {
      var c = b[i];
      if (c === 0x28 || c === 0x29 || c === 0x5C) o += '\\' + String.fromCharCode(c);
      else if (c < 32 || c > 126) o += '\\' + ('00' + c.toString(8)).slice(-3);
      else o += String.fromCharCode(c);
    }
    return o + ')';
  }
  function n(x) { return (Math.round(x * 100) / 100).toString(); }

  /* ---------- operadores de página (y medido a partir do topo) ---------- */
  function Page() { this.ops = []; }
  Page.prototype.text = function (x, yTop, str, font, size, tw) {
    this.ops.push('BT /' + font + ' ' + size + ' Tf ' + n(tw || 0) + ' Tw ' + n(x) + ' ' + n(PH - yTop) + ' Td ' + pdfStr(str) + ' Tj ET');
  };
  Page.prototype.line = function (x1, y1, x2, y2, w) {
    this.ops.push(n(w) + ' w ' + n(x1) + ' ' + n(PH - y1) + ' m ' + n(x2) + ' ' + n(PH - y2) + ' l S');
  };
  Page.prototype.rect = function (x, yTop, w, h, lw) {
    this.ops.push(n(lw) + ' w ' + n(x) + ' ' + n(PH - yTop - h) + ' ' + n(w) + ' ' + n(h) + ' re S');
  };
  Page.prototype.image = function (x, yTop, w, h) {
    this.ops.push('q ' + n(w) + ' 0 0 ' + n(h) + ' ' + n(x) + ' ' + n(PH - yTop - h) + ' cm /Im1 Do Q');
  };

  /* ---------- quebra de linha ---------- */
  function wrap(text, font, size, maxW) {
    var lines = [];
    String(text).split(/\r?\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), cur = '';
      if (!words.length) { lines.push(''); return; }
      words.forEach(function (w) {
        var t = cur ? cur + ' ' + w : w;
        if (width(font, t, size) <= maxW || !cur) {
          // palavra única maior que a largura: quebra por caractere
          if (!cur && width(font, w, size) > maxW) {
            var piece = '';
            for (var ch of w) {
              if (width(font, piece + ch, size) > maxW && piece) { lines.push(piece); piece = ch; }
              else piece += ch;
            }
            cur = piece;
          } else cur = t;
        } else { lines.push(cur); cur = w; }
      });
      lines.push(cur);
    });
    return lines.length ? lines : [''];
  }

  /* Parágrafo justificado composto de trechos {t, f, u} */
  function justified(page, runs, x, yTop, size, pitch) {
    var atoms = [];
    runs.forEach(function (r) {
      r.t.split(/( )/).forEach(function (p) {
        if (p === '') return;
        atoms.push({ t: p, f: r.f, u: !!r.u, sp: p === ' ' });
      });
    });
    var lines = [], cur = [], w = 0;
    atoms.forEach(function (a) {
      var aw = width(a.f, a.t, size);
      if (!a.sp && cur.length && w + aw > TEXTW + 0.01) {
        while (cur.length && cur[cur.length - 1].sp) { w -= cur[cur.length - 1].w; cur.pop(); }
        lines.push({ atoms: cur, w: w });
        cur = []; w = 0;
      }
      if (a.sp && !cur.length) return;
      a.w = aw; cur.push(a); w += aw;
    });
    while (cur.length && cur[cur.length - 1].sp) { w -= cur[cur.length - 1].w; cur.pop(); }
    if (cur.length) lines.push({ atoms: cur, w: w });

    lines.forEach(function (ln, i) {
      var last = i === lines.length - 1;
      var spaces = ln.atoms.filter(function (a) { return a.sp; }).length;
      var extra = (!last && spaces) ? (TEXTW - ln.w) / spaces : 0;
      var cx = x, y = yTop + i * pitch;
      ln.atoms.forEach(function (a, j) {
        var aw = a.w + (a.sp ? extra : 0);
        if (!a.sp) page.text(cx, y, a.t, a.f, size);
        var uline = a.u && (!a.sp || (ln.atoms[j - 1] && ln.atoms[j - 1].u && ln.atoms[j + 1] && ln.atoms[j + 1].u));
        if (uline) page.line(cx, y + 1.3, cx + aw, y + 1.3, 0.7);
        cx += aw;
      });
    });
    return lines.length;
  }

  /* ---------- composição da ficha ---------- */
  function compose(d) {
    var pg = new Page(), S = 11, PITCH = 15.44, PITCH_LBL = 23.45;

    // Cabeçalho
    pg.image(85.0, 64.1, 60.1, 64.5);
    pg.text(154.2, 93.35, 'ATESTADO DE EXECUÇÃO DE TRANSPORTE ESCOLAR', 'F2', S);
    pg.text(154.2, 114.8, '(Responsável pelo Aluno)', 'F2', S);

    // Parágrafo principal
    justified(pg, [
      { t: 'ATESTO que a empresa ', f: 'F1' },
      { t: EMPRESA, f: 'F2', u: true },
      { t: ', CNPJ ', f: 'F1' },
      { t: CNPJ, f: 'F2', u: true },
      { t: ', prestou os serviços de transporte escolar, no mês de ' + d.mesRef + ', de ' + d.anoRef + ', conforme informações abaixo:', f: 'F1' }
    ], LEFT, 168.4, S, 26.9);

    // Tabela 1
    var TL = 79.9, TR = 519.4, TC = 193.2, PAD = 5.4, VX = TC + PAD, VW = TR - PAD - VX;
    var vAluno = wrap(d.endAluno, 'F1', S, VW);
    var vNome = wrap(d.aluno, 'F1', S, VW);
    var vUni = wrap(d.unidade, 'F1', S, VW);
    var vEndU = wrap(d.endUnidade, 'F1', S, VW);
    function need(lines) { return lines * PITCH + 12; }
    var rows = [
      { min: 33.0, h: Math.max(33.0, need(vNome.length)) },
      { min: 68.0, h: Math.max(68.0, need(vAluno.length)) },
      { min: 34.0, h: Math.max(34.0, need(vUni.length)) },
      { min: 34.0, h: Math.max(34.0, need(vEndU.length)) },
      { min: 70.7, h: 70.7 }
    ];
    var y = 246.9, tops = [];
    rows.forEach(function (r) { tops.push(y); y += r.h; });
    var t1bottom = y;
    var grow = t1bottom - (246.9 + 33.0 + 68.0 + 34.0 + 34.0 + 70.7);

    pg.rect(TL, tops[0], TR - TL, t1bottom - tops[0], 0.5);
    for (var i = 1; i < rows.length; i++) pg.line(TL, tops[i], TR, tops[i], 0.5);
    pg.line(TC, tops[0], TC, t1bottom, 0.5);

    function centered(rowIdx, lines, pitch) {
      var cy = tops[rowIdx] + rows[rowIdx].h / 2;
      return cy - (lines - 1) * pitch / 2 - 1.25;
    }
    function putLines(rowIdx, lines, font) {
      var b0 = centered(rowIdx, lines.length, PITCH);
      lines.forEach(function (t, k) { pg.text(VX, b0 + k * PITCH, t, font, S); });
    }
    function putLabel(rowIdx, labels) {
      var b0 = centered(rowIdx, labels.length, PITCH_LBL);
      labels.forEach(function (t, k) {
        pg.text(TC - PAD - width('F1', t, S), b0 + k * PITCH_LBL, t, 'F1', S);
      });
    }
    putLabel(0, ['Nome do Aluno']);        putLines(0, vNome, 'F1');
    putLabel(1, ['Endereço', '(Aluno)']);  putLines(1, vAluno, 'F1');
    putLabel(2, ['Unidade Escolar']);      putLines(2, vUni, 'F1');
    putLabel(3, ['Endereço']);             putLines(3, vEndU, 'F1');
    putLabel(4, ['Período']);

    var pb = centered(4, 3, PITCH_LBL);
    ['manha', 'tarde', 'integral'].forEach(function (k, idx) {
      var by = pb + idx * PITCH_LBL, bx = 199.5, sz = 8.6, top = by - 8.0;
      pg.rect(bx, top, sz, sz, 0.8);
      if (d.periodo === k) {
        pg.line(bx + 1.6, top + 1.6, bx + sz - 1.6, top + sz - 1.6, 1.2);
        pg.line(bx + 1.6, top + sz - 1.6, bx + sz - 1.6, top + 1.6, 1.2);
      }
      pg.text(213.0, by, PERIODOS[k].rotulo, 'F1', S);
      pg.text(283.4, by, PERIODOS[k].horas, 'F1', S);
    });

    // Tabela 2 (Registro de ocorrências: preenchido à mão)
    var dy = grow;
    var shrink = Math.max(0, Math.min(60, dy - 12));
    var shift = dy - shrink;
    var t2 = 510.4 + dy, h3 = 104.6 - shrink;
    pg.rect(TL, t2, TR - TL, 34 + 34 + h3, 0.5);
    pg.line(TL, t2 + 34, TR, t2 + 34, 0.5);
    pg.line(TL, t2 + 68, TR, t2 + 68, 0.5);
    pg.text(92.5, 526.2 + dy, 'Registro de Ocorrências:', 'F2', S);
    pg.text(103.4, 560.2 + dy, 'Não', 'F1', S);
    var sx = 103.4, sy = 599.1 + dy;
    pg.text(sx, sy, 'Sim - ', 'F1', S); sx += width('F1', 'Sim - ', S);
    pg.text(sx, sy, 'Especificar', 'F2', S); sx += width('F2', 'Especificar', S);
    pg.text(sx, sy, ':', 'F1', S);

    // Data e assinatura
    var dateStr = CIDADE + ', ' + d.diaAss + ' de ' + d.mesAss + ' de ' + d.anoAss;
    pg.text(RIGHT - width('F2', dateStr, S), 719.55 + shift, dateStr, 'F2', S);
    pg.line(269.3, 762.45 + shift + 1.6, RIGHT, 762.45 + shift + 1.6, 0.8);
    var r1 = 'Responsável pelo Aluno', r2 = '(nome, RG, Assinatura)';
    pg.text(RIGHT - width('F2', r1, S), 783.9 + shift, r1, 'F2', S);
    pg.text(RIGHT - width('F2', r2, S), 807.3 + shift, r2, 'F2', S);
    return pg.ops.join('\n');
  }

  /* ---------- escrita do arquivo PDF ---------- */
  function ascii(s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; }
  function b64(s) { var bin = atob(s), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function hexUtf16(s) { var h = 'FEFF'; for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16)).slice(-4); return '<' + h + '>'; }

  function build(contentStr, title) {
    var parts = [], offs = [0], pos = 0;
    function push(b) { parts.push(b); pos += b.length; }
    function obj(num, dict, stream) {
      offs[num] = pos;
      push(ascii(num + ' 0 obj\n' + dict + (stream ? '\nstream\n' : '\n')));
      if (stream) { push(stream); push(ascii('\nendstream\n')); }
      push(ascii('endobj\n'));
    }
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    var content = ascii(contentStr);
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(PW) + ' ' + n(PH) + '] /Resources << /Font << /F1 5 0 R /F2 8 0 R >> /XObject << /Im1 11 0 R >> /ProcSet [/PDF /Text /ImageC] >> /Contents 4 0 R >>');
    obj(4, '<< /Length ' + content.length + ' >>', content);
    [['regular', 5], ['bold', 8]].forEach(function (p) {
      var f = A.fonts[p[0]], num = p[1], ttf = b64(f.ttf);
      obj(num, '<< /Type /Font /Subtype /TrueType /BaseFont /' + f.name + ' /FirstChar 32 /LastChar 255 /Widths [' + f.widths.join(' ') + '] /FontDescriptor ' + (num + 1) + ' 0 R /Encoding /WinAnsiEncoding >>');
      obj(num + 1, '<< /Type /FontDescriptor /FontName /' + f.name + ' /Flags 32 /FontBBox [' + f.bbox.join(' ') + '] /ItalicAngle 0 /Ascent ' + f.ascent + ' /Descent ' + f.descent + ' /CapHeight ' + f.capHeight + ' /StemV ' + (p[0] === 'bold' ? 140 : 80) + ' /FontFile2 ' + (num + 2) + ' 0 R >>');
      obj(num + 2, '<< /Length ' + ttf.length + ' /Length1 ' + ttf.length + ' >>', ttf);
    });
    var jpg = b64(A.logo);
    obj(11, '<< /Type /XObject /Subtype /Image /Width ' + A.logoW + ' /Height ' + A.logoH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>', jpg);
    obj(12, '<< /Title ' + hexUtf16(title) + ' /Producer (Ficha de Transporte) >>');
    var xref = pos, x = 'xref\n0 13\n0000000000 65535 f \n';
    for (var i = 1; i <= 12; i++) x += ('0000000000' + offs[i]).slice(-10) + ' 00000 n \n';
    x += 'trailer\n<< /Size 13 /Root 1 0 R /Info 12 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    push(ascii(x));
    var out = new Uint8Array(pos), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  function gerar(d) {
    var titulo = 'Atestado de transporte escolar - ' + d.aluno + ' - ' + d.mesRef + ' ' + d.anoRef;
    return build(compose(d), titulo);
  }

  window.FichaPDF = { gerar: gerar, MESES: MESES, PERIODOS: PERIODOS };
})();
