const CONFIG = {
  username: "admin",
  password: "MatazarnoS",
  authKey: "arriendo-form-auth",
  appScriptUrl: "https://script.google.com/macros/s/AKfycbyTaQX2vcFUL1_uc83RhjuQgW4i7mzLmmFbunb2H7lWcxl__AUxOOodmHdsL1xLz3R2/exec",
  contractStart: "2026-02-01",
  contractMonths: 24,
  monthlyRent: 150,
  dueDay: 15,
  currency: "USD"
};

const state = {
  payments: [],
  allocations: [],
  loadedFromServer: false
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const paymentForm = document.querySelector("#paymentForm");
const formLoginPanel = document.querySelector("#formLoginPanel");
const loginError = document.querySelector("#loginError");
const loginStatus = document.querySelector("#loginStatus");

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.hidden = true;
  loginStatus.textContent = "Validando acceso...";

  const enteredUser = document.querySelector("#username").value.trim();
  const enteredPassword = document.querySelector("#password").value.trim();
  const ok =
    enteredUser === CONFIG.username &&
    enteredPassword === CONFIG.password;

  if (!ok) {
    loginStatus.textContent = "";
    loginError.hidden = false;
    return;
  }

  setAuthFlag("1");
  unlockPaymentForm();
});

document.querySelector("#lockFormButton").addEventListener("click", () => {
  clearAuthFlag();
  lockPaymentForm();
  loginStatus.textContent = "";
  loginError.hidden = true;
});

document.querySelector("#refreshButton").addEventListener("click", loadData);
document.querySelector("#downloadHistoryPdfButton").addEventListener("click", downloadPaymentsPdf);
document.querySelector("#downloadHistoryCsvButton").addEventListener("click", downloadPaymentsCsv);
document.querySelector("#useMainReceiptForMonths").addEventListener("change", renderMonthReceiptAssignments);
paymentForm.addEventListener("submit", savePayment);

document.querySelectorAll(".sidebar a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".sidebar a").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

populateMonthSelect();
render();
loadData();
if (getAuthFlag() === "1") unlockPaymentForm();

function unlockPaymentForm() {
  loginStatus.textContent = "Acceso correcto.";
  loginError.hidden = true;
  formLoginPanel.hidden = true;
  paymentForm.hidden = false;
  setStatus("");
}

function lockPaymentForm() {
  formLoginPanel.hidden = false;
  paymentForm.hidden = true;
  loginForm.reset();
}

function showApp() {
  populateMonthSelect();
  render();
  loadData();
}

async function loadData() {
  if (!CONFIG.appScriptUrl) {
    state.loadedFromServer = false;
    render();
    return;
  }

  setStatus("Actualizando datos...");
  try {
    const response = await fetch(`${CONFIG.appScriptUrl}?action=list`, { method: "GET" });
    if (!response.ok) throw new Error("No se pudo leer Google Sheets.");
    const payload = await response.json();
    state.payments = payload.payments || [];
    state.allocations = payload.allocations || [];
    state.loadedFromServer = true;
    render();
    setStatus("Datos actualizados.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function savePayment(event) {
  event.preventDefault();
  const file = document.querySelector("#receiptFile").files[0];
  const coveredMonths = getSelectedCoveredMonths();

  if (!coveredMonths.length) {
    setStatus("Selecciona al menos un mes cubierto.");
    return;
  }

  const payment = {
    id: `local-${Date.now()}`,
    paymentDate: document.querySelector("#paymentDate").value,
    receiptNumber: document.querySelector("#receiptNumber").value.trim(),
    amount: Number(document.querySelector("#paymentAmount").value),
    coveredMonths,
    receiptUrl: document.querySelector("#receiptUrl").value.trim(),
    useMainReceiptForMonths: document.querySelector("#useMainReceiptForMonths").checked,
    monthReceipts: collectMonthReceiptUrls(),
    note: document.querySelector("#paymentNote").value.trim()
  };

  setStatus("Actualizando dashboard y Google Sheets...");

  try {
    const filePayload = file ? await fileToBase64(file) : null;
    const monthFiles = await collectMonthReceiptFiles();
    if (!CONFIG.appScriptUrl && filePayload) {
      payment.receiptUrl = `data:${filePayload.mimeType};base64,${filePayload.base64}`;
    }
    if (!CONFIG.appScriptUrl) {
      Object.assign(payment.monthReceipts, monthFiles.localUrls);
    }

    if (CONFIG.appScriptUrl) {
      const response = await fetch(CONFIG.appScriptUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "createPayment",
          payment,
          file: filePayload,
          monthFiles: monthFiles.payload
        })
      });
      if (!response.ok) throw new Error("No se pudo guardar en Google Sheets.");
      const saved = await response.json();
      state.payments.unshift(saved.payment || payment);
      state.allocations = buildPaymentAllocations(state.allocations, saved.payment || payment);
      state.loadedFromServer = true;
    } else {
      state.payments.unshift(payment);
      state.allocations = buildPaymentAllocations(state.allocations, payment);
      state.loadedFromServer = false;
    }

    paymentForm.reset();
    renderMonthReceiptAssignments();
    render();
    setStatus(CONFIG.appScriptUrl ? "Dashboard y Google Sheets actualizados." : "Dashboard actualizado solo en esta vista. Configura Apps Script para actualizar Google Sheets.");
  } catch (error) {
    setStatus(error.message);
  }
}

function render() {
  const months = buildContractMonths();
  const allocations = buildAllocations();
  const today = new Date();
  const enriched = months.map((month) => {
    const paid = allocations[month.key] || 0;
    const receiptUrls = getMonthReceiptUrls(month.key);
    const dueDate = new Date(month.year, month.monthIndex, CONFIG.dueDay + 1);
    let status = "Pendiente";
    if (paid >= CONFIG.monthlyRent) status = "Pagado";
    else if (paid > 0) status = "Pago parcial";
    else if (today >= dueDate) status = "Vencido";
    return { ...month, paid, receiptUrls, balance: Math.max(CONFIG.monthlyRent - paid, 0), status };
  });

  const paidCount = enriched.filter((month) => month.status === "Pagado").length;
  const overdue = enriched.filter((month) => month.status === "Vencido" || month.status === "Pago parcial");
  const elapsedCount = enriched.filter((month) => new Date(month.year, month.monthIndex, 1) <= new Date(today.getFullYear(), today.getMonth(), 1)).length;
  const remainingCount = Math.max(CONFIG.contractMonths - elapsedCount, 0);
  const overdueBalance = overdue.reduce((sum, month) => sum + month.balance, 0);

  document.querySelector("#paidMonths").textContent = paidCount;
  document.querySelector("#overdueMonths").textContent = overdue.length;
  document.querySelector("#remainingMonths").textContent = remainingCount;
  document.querySelector("#elapsedMonths").textContent = Math.min(elapsedCount, CONFIG.contractMonths);
  document.querySelector("#overdueBalance").textContent = money(overdueBalance);

  const first = enriched[0];
  const last = enriched[enriched.length - 1];
  document.querySelector("#contractRange").textContent = `${monthNames[first.monthIndex]} ${first.year} - ${monthNames[last.monthIndex]} ${last.year} - Canon mensual ${money(CONFIG.monthlyRent)}`;
  document.querySelector("#lastSync").textContent = state.loadedFromServer ? "Conectado a Google Sheets" : "Sin conexion a Google Sheets";

  renderMonths(enriched);
  renderPayments();
}

function renderMonths(months) {
  const container = document.querySelector("#monthTimeline");
  container.innerHTML = "";
  months.forEach((month) => {
    const article = document.createElement("article");
    const badgeClass = normalizeStatus(month.status);
    article.className = "month-card";
    const badge = month.status === "Pagado" && month.receiptUrls.length
      ? `<button class="badge ${badgeClass} receipt-button" type="button" data-receipt-url="${escapeHtml(month.receiptUrls[0])}">${month.status}</button>`
      : `<span class="badge ${badgeClass}">${month.status}</span>`;
    article.innerHTML = `
      ${badge}
      <strong>${monthNames[month.monthIndex]} ${month.year}</strong>
      <small>Aplicado: ${money(month.paid)}</small>
      <small>Saldo: ${money(month.balance)}</small>
    `;
    container.appendChild(article);
  });

  container.querySelectorAll(".receipt-button").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(button.dataset.receiptUrl, "_blank", "noopener,noreferrer");
    });
  });
}

function renderMonthReceiptAssignments() {
  const container = document.querySelector("#monthReceiptAssignments");
  const selectedMonths = getSelectedCoveredMonths();
  const useMainReceipt = document.querySelector("#useMainReceiptForMonths").checked;
  renderSelectedMonthsSummary(selectedMonths);
  container.innerHTML = "";

  if (!selectedMonths.length) {
    container.innerHTML = `<p class="muted">Selecciona uno o mas meses para asociar comprobantes.</p>`;
    return;
  }

  if (useMainReceipt) {
    container.innerHTML = `
      <div class="receipt-impact">
        <strong>Este comprobante afectara estos meses:</strong>
        <div class="selected-months-list">${selectedMonths.map((monthKey) => `<span>${formatMonthKey(monthKey)}</span>`).join("")}</div>
      </div>
    `;
    return;
  }

  selectedMonths.forEach((monthKey) => {
    const row = document.createElement("div");
    row.className = "month-receipt-row";
    row.dataset.month = monthKey;
    row.innerHTML = `
      <strong>${formatMonthKey(monthKey)}</strong>
      <label>
        Archivo
        <input class="month-receipt-file" data-month="${monthKey}" type="file" accept="image/jpeg,image/jpg,image/png,application/pdf">
      </label>
      <label>
        Enlace
        <input class="month-receipt-url" data-month="${monthKey}" type="url" placeholder="https://drive.google.com/...">
      </label>
    `;
    container.appendChild(row);
  });
}

function renderPayments() {
  const tbody = document.querySelector("#paymentsTable");
  tbody.innerHTML = "";
  const ordered = [...state.payments].sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));

  ordered.forEach((payment) => {
    const tr = document.createElement("tr");
    const months = (payment.coveredMonths || []).map(formatMonthKey).join(", ");
    const receiptUrl = getPaymentReceiptUrl(payment);
    const receiptLink = receiptUrl
      ? `<a href="${escapeHtml(receiptUrl)}" target="_blank" rel="noreferrer">Ver</a>`
      : "No registrado";
    tr.innerHTML = `
      <td>${formatDate(payment.paymentDate)}</td>
      <td>${escapeHtml(payment.receiptNumber || "")}</td>
      <td>${money(Number(payment.amount || 0))}</td>
      <td>${escapeHtml(months)}</td>
      <td>${receiptLink}</td>
      <td>${escapeHtml(payment.note || "")}</td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadPaymentsPdf() {
  const ordered = [...state.payments].sort((a, b) => String(a.paymentDate).localeCompare(String(b.paymentDate)));
  const generatedAt = new Date();
  const rows = ordered.map((payment) => {
    const coveredMonths = payment.coveredMonths || [];
    const appliedPerMonth = coveredMonths.length ? Number(payment.amount || 0) / coveredMonths.length : 0;
    return [
      formatDate(payment.paymentDate),
      payment.receiptNumber || "",
      money(Number(payment.amount || 0)),
      (payment.coveredMonths || []).map(formatMonthKey).join(", "),
      money(appliedPerMonth),
      payment.note || ""
    ];
  });

  const pdf = buildPaymentsPdf({
    title: "Historial de pagos efectuados",
    subtitle: `Contrato Arrendamiento Terreno Matazarnos - generado ${formatDate(toIsoDate(generatedAt))}`,
    headers: ["Fecha", "Comprobante", "Valor transferido", "Meses cubiertos", "Aplicado por mes", "Observacion"],
    rows
  });

  triggerDownload(pdf, `historial-pagos-matazarnos-${toIsoDate(generatedAt)}.pdf`);
}

function downloadPaymentsCsv() {
  const ordered = [...state.payments].sort((a, b) => String(a.paymentDate).localeCompare(String(b.paymentDate)));
  const generatedAt = new Date();
  const rows = [
    ["Fecha", "Comprobante", "Valor", "Meses cubiertos", "Enlace comprobante", "Observacion"],
    ...ordered.map((payment) => [
      formatDate(payment.paymentDate),
      payment.receiptNumber || "",
      Number(payment.amount || 0).toFixed(2),
      (payment.coveredMonths || []).map(formatMonthKey).join(", "),
      formatReceiptLinks(payment),
      payment.note || ""
    ])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `historial-pagos-matazarnos-${toIsoDate(generatedAt)}.csv`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function buildPaymentsPdf({ title, subtitle, headers, rows }) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 34;
  const rowHeight = 24;
  const headerHeight = 22;
  const tableTop = 500;
  const footerY = 24;
  const colWidths = [66, 82, 92, 210, 98, 226];
  const pages = [];
  let currentRows = [];
  let y = tableTop - headerHeight;

  rows.forEach((row) => {
    const wrapped = wrapPdfRow(row, colWidths);
    const height = Math.max(rowHeight, wrapped.lines * 11 + 12);
    if (y - height < 54 && currentRows.length) {
      pages.push(currentRows);
      currentRows = [];
      y = tableTop - headerHeight;
    }
    currentRows.push({ row, height, wrapped });
    y -= height;
  });
  pages.push(currentRows);

  const objects = [];
  const pageObjectNumbers = [];
  const contentObjectNumbers = [];

  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  const catalogNumber = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesNumber = addObject("");
  const fontNumber = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldNumber = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((pageRows, pageIndex) => {
    const content = buildPaymentsPdfPage({
      title,
      subtitle,
      headers,
      pageRows,
      totalRows: rows.length,
      pageIndex,
      pageCount: pages.length,
      pageWidth,
      pageHeight,
      margin,
      tableTop,
      headerHeight,
      footerY,
      colWidths
    });
    const contentNumber = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageNumber = addObject(`<< /Type /Page /Parent ${pagesNumber} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontNumber} 0 R /F2 ${fontBoldNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`);
    contentObjectNumbers.push(contentNumber);
    pageObjectNumbers.push(pageNumber);
  });

  objects[pagesNumber - 1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;
  objects[catalogNumber - 1] = "<< /Type /Catalog /Pages 2 0 R >>";

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([body], { type: "application/pdf" });
}

function buildPaymentsPdfPage({ title, subtitle, headers, pageRows, totalRows, pageIndex, pageCount, pageHeight, margin, tableTop, headerHeight, footerY, colWidths }) {
  const ops = [];
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const left = margin;

  drawText(ops, title, left, 552, 16, "F2");
  drawText(ops, subtitle, left, 532, 10, "F1");
  drawText(ops, `Total de pagos registrados: ${totalRows}`, left, 516, 9, "F1");
  drawLine(ops, left, 508, left + tableWidth, 508);

  let x = left;
  headers.forEach((header, index) => {
    drawRect(ops, x, tableTop - headerHeight, colWidths[index], headerHeight);
    drawText(ops, header, x + 4, tableTop - 15, 8, "F2");
    x += colWidths[index];
  });

  let y = tableTop - headerHeight;
  pageRows.forEach(({ row, height, wrapped }) => {
    x = left;
    row.forEach((cell, index) => {
      drawRect(ops, x, y - height, colWidths[index], height);
      const lines = wrapped.cells[index];
      lines.slice(0, Math.floor((height - 8) / 10)).forEach((line, lineIndex) => {
        drawText(ops, line, x + 4, y - 14 - lineIndex * 10, 7.5, "F1");
      });
      x += colWidths[index];
    });
    y -= height;
  });

  drawText(ops, `Pagina ${pageIndex + 1} de ${pageCount}`, left, footerY, 8, "F1");
  drawText(ops, "Documento generado automaticamente desde el dashboard.", left + 520, footerY, 8, "F1");
  return ops.join("\n");
}

function wrapPdfRow(row, colWidths) {
  const cells = row.map((cell, index) => wrapPdfText(String(cell || ""), Math.max(8, Math.floor(colWidths[index] / 4.3))));
  return {
    cells,
    lines: Math.max(...cells.map((cell) => cell.length))
  };
}

function wrapPdfText(text, maxChars) {
  const clean = pdfText(text);
  const words = clean.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawText(ops, text, x, y, size, font) {
  ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(pdfText(text))}) Tj ET`);
}

function drawLine(ops, x1, y1, x2, y2) {
  ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function drawRect(ops, x, y, width, height) {
  ops.push(`${x} ${y} ${width} ${height} re S`);
}

function escapePdfText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function pdfText(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function populateMonthSelect() {
  const container = document.querySelector("#coveredMonths");
  container.innerHTML = "";
  buildContractMonths().forEach((month) => {
    const label = document.createElement("label");
    label.className = "month-choice";
    label.innerHTML = `
      <input type="checkbox" value="${month.key}">
      <span>${monthNames[month.monthIndex]} ${month.year}</span>
    `;
    label.querySelector("input").addEventListener("change", renderMonthReceiptAssignments);
    container.appendChild(label);
  });
  renderMonthReceiptAssignments();
}

function getSelectedCoveredMonths() {
  return Array.from(document.querySelectorAll("#coveredMonths input:checked")).map((input) => input.value);
}

function renderSelectedMonthsSummary(selectedMonths) {
  const container = document.querySelector("#selectedCoveredMonthsSummary");
  if (!selectedMonths.length) {
    container.innerHTML = `<span class="muted">No hay meses seleccionados.</span>`;
    return;
  }

  container.innerHTML = `
    <strong>Meses afectados por este pago:</strong>
    <div class="selected-months-list">${selectedMonths.map((monthKey) => `<span>${formatMonthKey(monthKey)}</span>`).join("")}</div>
  `;
}

function buildContractMonths() {
  const [year, month] = CONFIG.contractStart.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  return Array.from({ length: CONFIG.contractMonths }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const monthIndex = date.getMonth();
    const itemYear = date.getFullYear();
    return {
      key: `${itemYear}-${String(monthIndex + 1).padStart(2, "0")}`,
      year: itemYear,
      monthIndex
    };
  });
}

function buildAllocations() {
  if (state.allocations.length) {
    return state.allocations.reduce((map, allocation) => {
      const month = String(allocation.month || "").trim();
      if (!month) return map;
      map[month] = (map[month] || 0) + Number(allocation.amount || 0);
      return map;
    }, {});
  }

  return state.payments.reduce((map, payment) => {
    const months = payment.coveredMonths || [];
    if (!months.length) return map;
    const splitAmount = Number(payment.amount || 0) / months.length;
    months.forEach((month) => {
      map[month] = (map[month] || 0) + splitAmount;
    });
    return map;
  }, {});
}

function buildPaymentAllocations(existingAllocations, payment) {
  const months = payment.coveredMonths || [];
  if (!months.length) return existingAllocations;
  const amountPerMonth = Number(payment.amount || 0) / months.length;
  const paymentId = payment.id || "";
  const withoutPayment = existingAllocations.filter((allocation) => allocation.paymentId !== paymentId);
  return [
    ...months.map((month) => ({ paymentId, month, amount: amountPerMonth })),
    ...withoutPayment
  ];
}

function getMonthReceiptUrls(monthKey) {
  return state.payments
    .filter((payment) => (payment.coveredMonths || []).includes(monthKey))
    .map((payment) => (payment.monthReceipts && payment.monthReceipts[monthKey]) || payment.receiptUrl || "")
    .filter(Boolean);
}

function getPaymentReceiptUrl(payment) {
  if (payment.receiptUrl) return payment.receiptUrl;
  const monthReceipts = payment.monthReceipts || {};
  const firstMonth = (payment.coveredMonths || []).find((monthKey) => monthReceipts[monthKey]);
  return firstMonth ? monthReceipts[firstMonth] : "";
}

function formatReceiptLinks(payment) {
  const monthReceipts = payment.monthReceipts || {};
  const entries = (payment.coveredMonths || [])
    .filter((monthKey) => monthReceipts[monthKey])
    .map((monthKey) => `${formatMonthKey(monthKey)}: ${monthReceipts[monthKey]}`);
  if (entries.length) return entries.join(" | ");
  return payment.receiptUrl || "";
}

function collectMonthReceiptUrls() {
  return Array.from(document.querySelectorAll(".month-receipt-url")).reduce((map, input) => {
    const value = input.value.trim();
    if (value) map[input.dataset.month] = value;
    return map;
  }, {});
}

async function collectMonthReceiptFiles() {
  const result = { payload: {}, localUrls: {} };
  const inputs = Array.from(document.querySelectorAll(".month-receipt-file"));
  for (const input of inputs) {
    const file = input.files[0];
    if (!file) continue;
    const filePayload = await fileToBase64(file);
    result.payload[input.dataset.month] = filePayload;
    result.localUrls[input.dataset.month] = `data:${filePayload.mimeType};base64,${filePayload.base64}`;
  }
  return result;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: result.split(",")[1]
      });
    };
    reader.onerror = () => reject(new Error("No se pudo leer el comprobante."));
    reader.readAsDataURL(file);
  });
}

function money(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: CONFIG.currency,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function toIsoDate(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

function normalizeStatus(status) {
  return status.toLowerCase().replace("pago ", "").replace(" ", "-");
}

function setStatus(message) {
  document.querySelector("#formStatus").textContent = message;
}

function getAuthFlag() {
  try {
    return sessionStorage.getItem(CONFIG.authKey);
  } catch (error) {
    return "";
  }
}

function setAuthFlag(value) {
  try {
    sessionStorage.setItem(CONFIG.authKey, value);
  } catch (error) {
    return;
  }
}

function clearAuthFlag() {
  try {
    sessionStorage.removeItem(CONFIG.authKey);
  } catch (error) {
    return;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
