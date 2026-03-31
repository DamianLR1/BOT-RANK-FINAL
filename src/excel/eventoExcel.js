const ExcelJS = require('exceljs');
const { fmtNum } = require('../utils/format');

async function generarExcelEvento({ nombre, startId, endId, usuarios, totalPuntos, fechaCalculo }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BotRANK';
  wb.created = new Date();

  const ws = wb.addWorksheet('Resumen');
  ws.properties.defaultRowHeight = 18;

  const ORO = 'FFD700', NEGRO = '0A0A0A', BLANCO = 'FFFFFF';
  const DORADO_OSCURO = '8A6010', PLATA = 'C0C0C0', BRONCE = 'CD7F32';

  // Título
  ws.mergeCells('A1:F1');
  ws.getCell('A1').value = `EVENTO: ${nombre}`;
  ws.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: ORO } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // Info
  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = `Calculado el ${fechaCalculo}  |  Start ID: ${startId}  |  End ID: ${endId}`;
  ws.getCell('A2').font = { name: 'Arial', size: 10, color: { argb: PLATA } };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '111111' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 20;

  ws.addRow([]);

  // Stats
  const mvp = usuarios[0];
  const promedio = usuarios.length ? Math.round(totalPuntos / usuarios.length) : 0;
  const statsRow = ws.addRow(['MVP', mvp?.usuario || '-', 'Total clan', fmtNum(totalPuntos) + ' pts', 'Participantes', usuarios.length]);
  statsRow.eachCell(cell => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: ORO } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1500' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top:{style:'thin',color:{argb:DORADO_OSCURO}}, bottom:{style:'thin',color:{argb:DORADO_OSCURO}}, left:{style:'thin',color:{argb:DORADO_OSCURO}}, right:{style:'thin',color:{argb:DORADO_OSCURO}} };
  });
  ws.getRow(4).height = 24;

  const promedioRow = ws.addRow(['Promedio por jugador', fmtNum(promedio) + ' pts', '', '', '', '']);
  promedioRow.getCell(1).font = { name: 'Arial', size: 10, color: { argb: PLATA } };
  promedioRow.getCell(2).font = { name: 'Arial', size: 10, color: { argb: PLATA } };
  promedioRow.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '111111' } });

  ws.addRow([]);

  // Headers tabla
  const headerRow = ws.addRow(['#', 'Usuario', 'Puntos', '% del total', 'Diferencia con 1ro']);
  headerRow.eachCell(cell => {
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: NEGRO } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: DORADO_OSCURO } } };
  });
  ws.getRow(7).height = 22;

  // Datos
  const top1 = usuarios[0]?.puntos || 1;
  usuarios.forEach((u, i) => {
    const pct = ((u.puntos / totalPuntos) * 100).toFixed(1) + '%';
    const diff = i === 0 ? '-' : '-' + fmtNum(top1 - u.puntos) + ' pts';
    const row = ws.addRow([i + 1, u.usuario, u.puntos, pct, diff]);

    let bgColor = i % 2 === 0 ? '0D0D0D' : '111108';
    let textColor = BLANCO;
    if (i === 0) { bgColor = '2A1F00'; textColor = ORO; }
    else if (i === 1) { bgColor = '1A1A1A'; textColor = PLATA; }
    else if (i === 2) { bgColor = '1A0F00'; textColor = BRONCE; }

    row.eachCell(cell => {
      cell.font = { name: 'Arial', size: 11, color: { argb: textColor }, bold: i < 3 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'hair', color: { argb: '2A2000' } } };
    });
    row.getCell(2).alignment = { horizontal: 'left' };
    row.height = 20;
  });

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 10;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { generarExcelEvento };
