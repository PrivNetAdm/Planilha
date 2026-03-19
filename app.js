const QUARTERS = [
  { id: "q1", label: "1º Trimestre", months: ["Janeiro", "Fevereiro", "Março"] },
  { id: "q2", label: "2º Trimestre", months: ["Abril", "Maio", "Junho"] },
  { id: "q3", label: "3º Trimestre", months: ["Julho", "Agosto", "Setembro"] },
  { id: "q4", label: "4º Trimestre", months: ["Outubro", "Novembro", "Dezembro"] },
];

const MONTH_FIELDS = [
  {
    key: "grossRevenue",
    label: "Faturamento bruto do mês",
    hint: "Receita bruta operacional do comércio no mês.",
  },
  {
    key: "returns",
    label: "Devoluções / cancelamentos / descontos incondicionais",
    hint: "Reduções operacionais para IRPJ/CSLL.",
  },
  {
    key: "financialRevenue",
    label: "Receita financeira bruta",
    hint: "Entra 100% na base de IRPJ/CSLL; não entra em PIS/COFINS cumulativos.",
  },
  {
    key: "withheldIrMonth",
    label: "IRRF do mês sobre receitas financeiras",
    hint: "Compensável no IRPJ do trimestre.",
  },
  {
    key: "icmsAmount",
    label: "ICMS destacado do mês",
    hint: "Usado para exclusão da base de PIS/COFINS conforme informado por você.",
  },
  {
    key: "monophaseRevenue",
    label: "Receita monofásica do mês",
    hint: "Também fica fora da base de PIS/COFINS deste dashboard.",
  },
];

const CONSTANTS = {
  quarterlyLimit: 1250000,
  annualLimitIrpj: 5000000,
  annualLimitCsll2026: 3750000,
  presumptiveIrpj: 0.08,
  presumptiveIrpjExcess: 0.088,
  presumptiveCsll: 0.12,
  presumptiveCsllExcess: 0.132,
  irpjRate: 0.15,
  irpjAdditionalRate: 0.1,
  irpjAdditionalThreshold: 60000,
  csllRate: 0.09,
  pisRate: 0.0065,
  cofinsRate: 0.03,
};

const storageKey = "planilha-lucro-presumido-2026-comercio";
let state = loadState();

function createDefaultState() {
  return {
    quarters: QUARTERS.map((quarter) => ({
      id: quarter.id,
      months: quarter.months.map((name) => ({
        name,
        grossRevenue: 0,
        returns: 0,
        financialRevenue: 0,
        withheldIrMonth: 0,
        icmsAmount: 0,
        monophaseRevenue: 0,
      })),
    })),
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return createDefaultState();
    const parsed = JSON.parse(saved);
    return mergeWithDefault(parsed);
  } catch {
    return createDefaultState();
  }
}

function mergeWithDefault(partial) {
  const base = createDefaultState();
  if (!partial?.quarters) return base;

  base.quarters.forEach((quarter, qIndex) => {
    const savedQuarter = partial.quarters[qIndex];
    if (!savedQuarter?.months) return;
    quarter.months.forEach((month, mIndex) => {
      const savedMonth = savedQuarter.months[mIndex] || {};
      Object.keys(month).forEach((field) => {
        if (field === "name") return;
        month[field] = sanitizeNumber(savedMonth[field]);
      });
    });
  });

  return base;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function sanitizeNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2).replace(".", ",")}%`;
}

function renderApp() {
  renderQuarterStructure();
  const calculation = calculateAll();
  renderAnnualSummary(calculation);
  renderQuarterResults(calculation);
  renderRecalcTables(calculation);
  renderDetailedOutput(calculation);
}

function renderQuarterStructure() {
  const quarterTabs = document.getElementById("quarterTabs");
  const quarterPanels = document.getElementById("quarterPanels");
  quarterTabs.innerHTML = "";
  quarterPanels.innerHTML = "";

  QUARTERS.forEach((quarter, qIndex) => {
    const tab = document.createElement("button");
    tab.className = `quarter-tab ${qIndex === 0 ? "active" : ""}`;
    tab.textContent = quarter.label;
    tab.type = "button";
    tab.dataset.target = quarter.id;
    tab.addEventListener("click", () => activateQuarter(quarter.id));
    quarterTabs.appendChild(tab);

    const panel = document.getElementById("quarterPanelTemplate").content.firstElementChild.cloneNode(true);
    panel.id = quarter.id;
    if (qIndex === 0) panel.classList.remove("hidden");
    panel.querySelector(".quarter-title").textContent = quarter.label;
    panel.querySelector(".quarter-subtitle").textContent = `Meses: ${quarter.months.join(", ")}. Informe receitas, ICMS e IRRF mês a mês.`;

    const monthTabs = panel.querySelector(".month-tabs");
    const monthPanels = panel.querySelector(".month-panels");

    quarter.months.forEach((monthName, mIndex) => {
      const monthTab = document.createElement("button");
      monthTab.className = `month-tab ${mIndex === 0 ? "active" : ""}`;
      monthTab.type = "button";
      monthTab.textContent = monthName;
      monthTab.dataset.target = `${quarter.id}-m${mIndex}`;
      monthTab.addEventListener("click", () => activateMonth(panel, monthTab.dataset.target));
      monthTabs.appendChild(monthTab);

      const monthPanel = document.getElementById("monthPanelTemplate").content.firstElementChild.cloneNode(true);
      monthPanel.id = `${quarter.id}-m${mIndex}`;
      if (mIndex === 0) monthPanel.classList.remove("hidden");
      const monthGrid = monthPanel.querySelector(".month-grid");
      const monthState = state.quarters[qIndex].months[mIndex];

      MONTH_FIELDS.forEach((field) => {
        const fieldCard = document.createElement("div");
        fieldCard.className = "field-card";

        const label = document.createElement("label");
        label.setAttribute("for", `${quarter.id}-${mIndex}-${field.key}`);
        label.textContent = field.label;

        const input = document.createElement("input");
        input.id = `${quarter.id}-${mIndex}-${field.key}`;
        input.type = "text";
        input.inputMode = "decimal";
        input.value = monthState[field.key] ? monthState[field.key].toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
        input.placeholder = "0,00";
        input.addEventListener("change", (event) => {
          const value = sanitizeNumber(event.target.value);
          state.quarters[qIndex].months[mIndex][field.key] = value;
          event.target.value = value ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
          saveState();
          renderApp();
        });

        const hint = document.createElement("span");
        hint.className = "hint";
        hint.textContent = field.hint;

        fieldCard.append(label, input, hint);
        monthGrid.appendChild(fieldCard);
      });

      monthPanels.appendChild(monthPanel);
    });

    quarterPanels.appendChild(panel);
  });
}

function activateQuarter(targetId) {
  document.querySelectorAll(".quarter-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetId);
  });
  document.querySelectorAll(".quarter-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== targetId);
  });
}

function activateMonth(quarterPanel, targetId) {
  quarterPanel.querySelectorAll(".month-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetId);
  });
  quarterPanel.querySelectorAll(".month-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== targetId);
  });
}

function calculateAll() {
  const quarterInputs = state.quarters.map((quarter, index) => calculateQuarterInput(quarter, index));
  const irpjOriginal = calculateOriginalExcessSeries(quarterInputs, {
    startQuarterIndex: 0,
    annualLimit: CONSTANTS.annualLimitIrpj,
  });
  const csllOriginal = calculateOriginalExcessSeries(quarterInputs, {
    startQuarterIndex: 1,
    annualLimit: CONSTANTS.annualLimitCsll2026,
  });

  const irpjFinal = calculateFinalExcessSeries(irpjOriginal, CONSTANTS.annualLimitIrpj);
  const csllFinal = calculateFinalExcessSeries(csllOriginal, CONSTANTS.annualLimitCsll2026);

  const quarterResults = quarterInputs.map((input, index) => {
    const irpj = buildIrpjQuarterResult(input, irpjOriginal[index], irpjFinal[index]);
    const csll = buildCsllQuarterResult(input, csllOriginal[index], csllFinal[index]);
    const pisCofins = buildPisCofinsQuarterResult(input);
    return { ...input, irpj, csll, pisCofins };
  });

  const annual = buildAnnualSummary(quarterResults);
  return { quarterResults, annual, irpjOriginal, irpjFinal, csllOriginal, csllFinal };
}

function calculateQuarterInput(quarterState, quarterIndex) {
  const months = quarterState.months.map((month) => ({
    ...month,
    operationalNetRevenue: Math.max(month.grossRevenue - month.returns, 0),
    pisCofinsBase: Math.max(month.grossRevenue - month.returns - month.icmsAmount - month.monophaseRevenue, 0),
  }));

  return {
    quarterIndex,
    quarterLabel: QUARTERS[quarterIndex].label,
    months,
    grossRevenue: sum(months, "grossRevenue"),
    returns: sum(months, "returns"),
    operationalRevenue: sum(months, "operationalNetRevenue"),
    financialRevenue: sum(months, "financialRevenue"),
    withheldIr: sum(months, "withheldIrMonth"),
    icmsAmount: sum(months, "icmsAmount"),
    monophaseRevenue: sum(months, "monophaseRevenue"),
    pisCofinsBase: sum(months, "pisCofinsBase"),
  };
}

function sum(items, key) {
  return items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

function calculateOriginalExcessSeries(quarterInputs, options) {
  const results = [];
  let carryLimit = 0;
  let eligibleRevenueTotal = 0;

  quarterInputs.forEach((quarter, index) => {
    const active = index >= options.startQuarterIndex;
    const availableLimit = active ? CONSTANTS.quarterlyLimit + carryLimit : 0;
    const operationalRevenue = active ? quarter.operationalRevenue : 0;
    const withinLimit = active ? Math.min(operationalRevenue, availableLimit) : quarter.operationalRevenue;
    const excess = active ? Math.max(operationalRevenue - availableLimit, 0) : 0;
    carryLimit = active ? Math.max(availableLimit - operationalRevenue, 0) : 0;
    eligibleRevenueTotal += operationalRevenue;

    results.push({
      quarterIndex: index,
      active,
      operationalRevenue,
      availableLimit,
      withinLimit,
      excess,
      carryLimitForward: carryLimit,
      eligibleRevenueTotal,
      annualLimit: options.annualLimit,
    });
  });

  return results;
}

function calculateFinalExcessSeries(originalSeries, annualLimit) {
  const eligibleRevenueTotal = originalSeries.reduce((sumValue, item) => sumValue + (item.active ? item.operationalRevenue : 0), 0);
  const annualExcess = Math.max(eligibleRevenueTotal - annualLimit, 0);
  const originalExcessTotal = originalSeries.reduce((sumValue, item) => sumValue + item.excess, 0);

  if (annualExcess <= 0) {
    return originalSeries.map((item) => ({
      ...item,
      finalExcess: 0,
      adjustmentType: item.excess > 0 ? "zerado-no-recalculo" : "sem-excesso",
    }));
  }

  if (originalExcessTotal <= annualExcess || originalExcessTotal === 0) {
    return originalSeries.map((item) => ({
      ...item,
      finalExcess: item.excess,
      adjustmentType: item.excess > 0 ? "mantido" : "sem-excesso",
    }));
  }

  return originalSeries.map((item) => ({
    ...item,
    finalExcess: item.excess > 0 ? annualExcess * (item.excess / originalExcessTotal) : 0,
    adjustmentType: item.excess > 0 ? "redistribuido" : "sem-excesso",
  }));
}

function buildIrpjQuarterResult(input, original, final) {
  const originalBaseRegular = original.withinLimit * CONSTANTS.presumptiveIrpj;
  const originalBaseExcess = original.excess * CONSTANTS.presumptiveIrpjExcess;
  const originalFinancialBase = input.financialRevenue;
  const originalBaseTotal = originalBaseRegular + originalBaseExcess + originalFinancialBase;
  const originalBaseAdditional = Math.max(originalBaseTotal - CONSTANTS.irpjAdditionalThreshold, 0);
  const originalTaxMain = originalBaseTotal * CONSTANTS.irpjRate;
  const originalTaxAdditional = originalBaseAdditional * CONSTANTS.irpjAdditionalRate;
  const originalGrossTax = originalTaxMain + originalTaxAdditional;
  const originalNetTax = Math.max(originalGrossTax - input.withheldIr, 0);

  const finalBaseRegular = (input.operationalRevenue - final.finalExcess) * CONSTANTS.presumptiveIrpj;
  const finalBaseExcess = final.finalExcess * CONSTANTS.presumptiveIrpjExcess;
  const finalFinancialBase = input.financialRevenue;
  const finalBaseTotal = finalBaseRegular + finalBaseExcess + finalFinancialBase;
  const finalBaseAdditional = Math.max(finalBaseTotal - CONSTANTS.irpjAdditionalThreshold, 0);
  const finalTaxMain = finalBaseTotal * CONSTANTS.irpjRate;
  const finalTaxAdditional = finalBaseAdditional * CONSTANTS.irpjAdditionalRate;
  const finalGrossTax = finalTaxMain + finalTaxAdditional;
  const finalNetTax = Math.max(finalGrossTax - input.withheldIr, 0);
  const credit = Math.max(originalGrossTax - finalGrossTax, 0);

  return {
    original: {
      withinLimit: original.withinLimit,
      excess: original.excess,
      baseRegular: originalBaseRegular,
      baseExcess: originalBaseExcess,
      financialBase: originalFinancialBase,
      baseTotal: originalBaseTotal,
      baseAdditional: originalBaseAdditional,
      taxMain: originalTaxMain,
      taxAdditional: originalTaxAdditional,
      grossTax: originalGrossTax,
      netTax: originalNetTax,
      withheldIr: input.withheldIr,
      availableLimit: original.availableLimit,
      carryLimitForward: original.carryLimitForward,
    },
    final: {
      excess: final.finalExcess,
      baseRegular: finalBaseRegular,
      baseExcess: finalBaseExcess,
      financialBase: finalFinancialBase,
      baseTotal: finalBaseTotal,
      baseAdditional: finalBaseAdditional,
      taxMain: finalTaxMain,
      taxAdditional: finalTaxAdditional,
      grossTax: finalGrossTax,
      netTax: finalNetTax,
      adjustmentType: final.adjustmentType,
    },
    credit,
  };
}

function buildCsllQuarterResult(input, original, final) {
  const originalBaseRegular = (original.active ? original.withinLimit : input.operationalRevenue) * CONSTANTS.presumptiveCsll;
  const originalBaseExcess = original.excess * CONSTANTS.presumptiveCsllExcess;
  const originalFinancialBase = input.financialRevenue;
  const originalBaseTotal = originalBaseRegular + originalBaseExcess + originalFinancialBase;
  const originalGrossTax = originalBaseTotal * CONSTANTS.csllRate;

  const activeFinal = original.active;
  const finalRegularOperational = activeFinal ? input.operationalRevenue - final.finalExcess : input.operationalRevenue;
  const finalBaseRegular = finalRegularOperational * CONSTANTS.presumptiveCsll;
  const finalBaseExcess = final.finalExcess * CONSTANTS.presumptiveCsllExcess;
  const finalFinancialBase = input.financialRevenue;
  const finalBaseTotal = finalBaseRegular + finalBaseExcess + finalFinancialBase;
  const finalGrossTax = finalBaseTotal * CONSTANTS.csllRate;
  const credit = Math.max(originalGrossTax - finalGrossTax, 0);

  return {
    original: {
      withinLimit: original.withinLimit,
      excess: original.excess,
      baseRegular: originalBaseRegular,
      baseExcess: originalBaseExcess,
      financialBase: originalFinancialBase,
      baseTotal: originalBaseTotal,
      grossTax: originalGrossTax,
      availableLimit: original.availableLimit,
      carryLimitForward: original.carryLimitForward,
      active: original.active,
    },
    final: {
      excess: final.finalExcess,
      baseRegular: finalBaseRegular,
      baseExcess: finalBaseExcess,
      financialBase: finalFinancialBase,
      baseTotal: finalBaseTotal,
      grossTax: finalGrossTax,
      adjustmentType: final.adjustmentType,
      active: original.active,
    },
    credit,
  };
}

function buildPisCofinsQuarterResult(input) {
  const pis = input.pisCofinsBase * CONSTANTS.pisRate;
  const cofins = input.pisCofinsBase * CONSTANTS.cofinsRate;
  return {
    base: input.pisCofinsBase,
    pis,
    cofins,
    total: pis + cofins,
  };
}

function buildAnnualSummary(quarterResults) {
  const totals = quarterResults.reduce(
    (acc, quarter) => {
      acc.grossRevenue += quarter.grossRevenue;
      acc.returns += quarter.returns;
      acc.operationalRevenue += quarter.operationalRevenue;
      acc.financialRevenue += quarter.financialRevenue;
      acc.withheldIr += quarter.withheldIr;
      acc.icmsAmount += quarter.icmsAmount;
      acc.monophaseRevenue += quarter.monophaseRevenue;
      acc.pisCofinsBase += quarter.pisCofinsBase;
      acc.irpjOriginal += quarter.irpj.original.grossTax;
      acc.irpjFinal += quarter.irpj.final.grossTax;
      acc.irpjCredit += quarter.irpj.credit;
      acc.csllOriginal += quarter.csll.original.grossTax;
      acc.csllFinal += quarter.csll.final.grossTax;
      acc.csllCredit += quarter.csll.credit;
      acc.pis += quarter.pisCofins.pis;
      acc.cofins += quarter.pisCofins.cofins;
      return acc;
    },
    {
      grossRevenue: 0,
      returns: 0,
      operationalRevenue: 0,
      financialRevenue: 0,
      withheldIr: 0,
      icmsAmount: 0,
      monophaseRevenue: 0,
      pisCofinsBase: 0,
      irpjOriginal: 0,
      irpjFinal: 0,
      irpjCredit: 0,
      csllOriginal: 0,
      csllFinal: 0,
      csllCredit: 0,
      pis: 0,
      cofins: 0,
    }
  );

  totals.irpjNetFourthQuarter = Math.max(quarterResults[3].irpj.original.netTax - totals.irpjCredit, 0);
  totals.irpjNegativeBalance = Math.max(totals.irpjCredit - quarterResults[3].irpj.original.netTax, 0);
  totals.csllNetFourthQuarter = Math.max(quarterResults[3].csll.original.grossTax - totals.csllCredit, 0);
  totals.csllNegativeBalance = Math.max(totals.csllCredit - quarterResults[3].csll.original.grossTax, 0);
  totals.totalFederalBurden = totals.irpjFinal + totals.csllFinal + totals.pis + totals.cofins;
  return totals;
}

function renderAnnualSummary(calculation) {
  const annualSummary = document.getElementById("annualSummary");
  const cards = [
    ["Receita bruta anual", calculation.annual.grossRevenue],
    ["Receita operacional líquida", calculation.annual.operationalRevenue],
    ["Receita financeira anual", calculation.annual.financialRevenue],
    ["Base anual PIS/COFINS", calculation.annual.pisCofinsBase],
    ["IRPJ bruto reapurado", calculation.annual.irpjFinal],
    ["CSLL reapurada", calculation.annual.csllFinal],
    ["Crédito de recálculo IRPJ", calculation.annual.irpjCredit],
    ["Crédito de recálculo CSLL", calculation.annual.csllCredit],
    ["PIS + COFINS", calculation.annual.pis + calculation.annual.cofins],
    ["Carga federal total estimada", calculation.annual.totalFederalBurden],
  ];

  annualSummary.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="summary-card">
          <h3>${label}</h3>
          <div class="value">${formatCurrency(value)}</div>
        </article>
      `
    )
    .join("");
}

function renderQuarterResults(calculation) {
  calculation.quarterResults.forEach((quarter, index) => {
    const panel = document.getElementById(QUARTERS[index].id);
    const badges = panel.querySelector(".quarter-badges");
    const originalIrpj = calculation.irpjOriginal[index];
    const originalCsll = calculation.csllOriginal[index];
    badges.innerHTML = `
      <span class="badge">Limite IRPJ no tri: ${formatCurrency(originalIrpj.availableLimit || 0)}</span>
      <span class="badge ${quarter.irpj.original.excess > 0 ? "warn" : "success"}">Excedente IRPJ: ${formatCurrency(quarter.irpj.original.excess)}</span>
      <span class="badge ${quarter.csll.original.excess > 0 ? "warn" : "success"}">Excedente CSLL: ${formatCurrency(quarter.csll.original.excess)}</span>
      <span class="badge">IRRF trimestral: ${formatCurrency(quarter.withheldIr)}</span>
    `;

    const quarterResults = panel.querySelector(".quarter-results");
    quarterResults.innerHTML = `
      ${miniCard("Receita operacional líquida", formatCurrency(quarter.operationalRevenue), `Faturamento líquido do trimestre: ${formatCurrency(quarter.operationalRevenue)}.`)}
      ${miniCard("Receitas financeiras", formatCurrency(quarter.financialRevenue), `Somadas integralmente à base do IRPJ e da CSLL.`)}
      ${miniCard("Base PIS/COFINS", formatCurrency(quarter.pisCofins.base), `Após excluir ICMS informado e monofásicos.`)}
      ${miniCard("IRPJ original / reapurado", `${formatCurrency(quarter.irpj.original.grossTax)} / ${formatCurrency(quarter.irpj.final.grossTax)}`, `Crédito do recálculo: ${formatCurrency(quarter.irpj.credit)}.`)}
      ${miniCard("CSLL original / reapurada", `${formatCurrency(quarter.csll.original.grossTax)} / ${formatCurrency(quarter.csll.final.grossTax)}`, `Crédito do recálculo: ${formatCurrency(quarter.csll.credit)}.`)}
      ${miniCard("PIS / COFINS", `${formatCurrency(quarter.pisCofins.pis)} / ${formatCurrency(quarter.pisCofins.cofins)}`, `Total das contribuições do trimestre: ${formatCurrency(quarter.pisCofins.total)}.`)}
    `;
  });
}

function miniCard(title, value, note) {
  return `
    <article class="mini-card">
      <h4>${title}</h4>
      <div class="value">${value}</div>
      <p class="table-note">${note}</p>
    </article>
  `;
}

function renderRecalcTables(calculation) {
  const container = document.getElementById("recalcTables");
  const irpjRows = calculation.quarterResults
    .map(
      (quarter) => `
        <tr>
          <td>${quarter.quarterLabel}</td>
          <td>${formatCurrency(quarter.irpj.original.grossTax)}</td>
          <td>${formatCurrency(quarter.irpj.final.grossTax)}</td>
          <td>${formatCurrency(quarter.irpj.credit)}</td>
          <td>${formatCurrency(quarter.irpj.original.netTax)}</td>
        </tr>
      `
    )
    .join("");

  const csllRows = calculation.quarterResults
    .map(
      (quarter) => `
        <tr>
          <td>${quarter.quarterLabel}</td>
          <td>${formatCurrency(quarter.csll.original.grossTax)}</td>
          <td>${formatCurrency(quarter.csll.final.grossTax)}</td>
          <td>${formatCurrency(quarter.csll.credit)}</td>
          <td>${quarter.csll.original.active ? "Ativo" : "Sem acréscimo em 2026"}</td>
        </tr>
      `
    )
    .join("");

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>IRPJ</th>
            <th>Apuração original</th>
            <th>Apuração reprocessada</th>
            <th>Crédito</th>
            <th>IRPJ líquido após IRRF</th>
          </tr>
        </thead>
        <tbody>${irpjRows}</tbody>
      </table>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>CSLL</th>
            <th>Apuração original</th>
            <th>Apuração reprocessada</th>
            <th>Crédito</th>
            <th>Status 2026</th>
          </tr>
        </thead>
        <tbody>${csllRows}</tbody>
      </table>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fechamento do 4º trimestre</th>
            <th>DARF original</th>
            <th>Crédito do recálculo</th>
            <th>Valor líquido a recolher</th>
            <th>Saldo negativo remanescente</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>IRPJ</td>
            <td>${formatCurrency(calculation.quarterResults[3].irpj.original.netTax)}</td>
            <td>${formatCurrency(calculation.annual.irpjCredit)}</td>
            <td>${formatCurrency(calculation.annual.irpjNetFourthQuarter)}</td>
            <td class="${calculation.annual.irpjNegativeBalance > 0 ? "highlight-positive" : ""}">${formatCurrency(calculation.annual.irpjNegativeBalance)}</td>
          </tr>
          <tr>
            <td>CSLL</td>
            <td>${formatCurrency(calculation.quarterResults[3].csll.original.grossTax)}</td>
            <td>${formatCurrency(calculation.annual.csllCredit)}</td>
            <td>${formatCurrency(calculation.annual.csllNetFourthQuarter)}</td>
            <td class="${calculation.annual.csllNegativeBalance > 0 ? "highlight-positive" : ""}">${formatCurrency(calculation.annual.csllNegativeBalance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderDetailedOutput(calculation) {
  const container = document.getElementById("detailedOutput");
  const revenueRows = calculation.quarterResults
    .map(
      (quarter) => `
        <tr>
          <td>${quarter.quarterLabel}</td>
          <td>${formatCurrency(quarter.grossRevenue)}</td>
          <td>${formatCurrency(quarter.returns)}</td>
          <td>${formatCurrency(quarter.operationalRevenue)}</td>
          <td>${formatCurrency(quarter.financialRevenue)}</td>
          <td>${formatCurrency(quarter.withheldIr)}</td>
          <td>${formatCurrency(quarter.icmsAmount)}</td>
          <td>${formatCurrency(quarter.monophaseRevenue)}</td>
          <td>${formatCurrency(quarter.pisCofinsBase)}</td>
        </tr>
      `
    )
    .join("");

  const irpjRows = calculation.quarterResults
    .map(
      (quarter) => `
        <tr>
          <td>${quarter.quarterLabel}</td>
          <td>${formatCurrency(quarter.irpj.original.availableLimit)}</td>
          <td>${formatCurrency(quarter.irpj.original.withinLimit)}</td>
          <td>${formatCurrency(quarter.irpj.original.excess)}</td>
          <td>${formatCurrency(quarter.irpj.final.excess)}</td>
          <td>${formatCurrency(quarter.irpj.final.baseRegular)}</td>
          <td>${formatCurrency(quarter.irpj.final.baseExcess)}</td>
          <td>${formatCurrency(quarter.irpj.final.financialBase)}</td>
          <td>${formatCurrency(quarter.irpj.final.baseTotal)}</td>
          <td>${formatCurrency(quarter.irpj.final.taxMain)}</td>
          <td>${formatCurrency(quarter.irpj.final.taxAdditional)}</td>
          <td>${formatCurrency(quarter.irpj.final.grossTax)}</td>
        </tr>
      `
    )
    .join("");

  const csllRows = calculation.quarterResults
    .map(
      (quarter) => `
        <tr>
          <td>${quarter.quarterLabel}</td>
          <td>${formatCurrency(quarter.csll.original.availableLimit)}</td>
          <td>${formatCurrency(quarter.csll.original.withinLimit)}</td>
          <td>${formatCurrency(quarter.csll.original.excess)}</td>
          <td>${formatCurrency(quarter.csll.final.excess)}</td>
          <td>${formatCurrency(quarter.csll.final.baseRegular)}</td>
          <td>${formatCurrency(quarter.csll.final.baseExcess)}</td>
          <td>${formatCurrency(quarter.csll.final.financialBase)}</td>
          <td>${formatCurrency(quarter.csll.final.baseTotal)}</td>
          <td>${formatCurrency(quarter.csll.final.grossTax)}</td>
          <td>${quarter.csll.final.adjustmentType}</td>
        </tr>
      `
    )
    .join("");

  const pisRows = calculation.quarterResults
    .map(
      (quarter) => `
        <tr>
          <td>${quarter.quarterLabel}</td>
          <td>${formatCurrency(quarter.grossRevenue)}</td>
          <td>${formatCurrency(quarter.icmsAmount)}</td>
          <td>${formatCurrency(quarter.monophaseRevenue)}</td>
          <td>${formatCurrency(quarter.pisCofins.base)}</td>
          <td>${formatCurrency(quarter.pisCofins.pis)}</td>
          <td>${formatCurrency(quarter.pisCofins.cofins)}</td>
          <td>${formatCurrency(quarter.pisCofins.total)}</td>
        </tr>
      `
    )
    .join("");

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Receitas por trimestre</th>
            <th>Faturamento bruto</th>
            <th>Deduções operacionais</th>
            <th>Receita operacional líquida</th>
            <th>Receita financeira</th>
            <th>IRRF mensal acumulado</th>
            <th>ICMS informado</th>
            <th>Monofásicos</th>
            <th>Base PIS/COFINS</th>
          </tr>
        </thead>
        <tbody>${revenueRows}</tbody>
      </table>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>IRPJ</th>
            <th>Limite utilizado</th>
            <th>Parcela regular</th>
            <th>Excesso original</th>
            <th>Excesso final</th>
            <th>Base 8%</th>
            <th>Base 8,8%</th>
            <th>Receita financeira</th>
            <th>Base total</th>
            <th>IRPJ 15%</th>
            <th>Adicional 10%</th>
            <th>IRPJ bruto</th>
          </tr>
        </thead>
        <tbody>${irpjRows}</tbody>
      </table>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>CSLL</th>
            <th>Limite utilizado</th>
            <th>Parcela regular</th>
            <th>Excesso original</th>
            <th>Excesso final</th>
            <th>Base 12%</th>
            <th>Base 13,2%</th>
            <th>Receita financeira</th>
            <th>Base total</th>
            <th>CSLL 9%</th>
            <th>Status do recálculo</th>
          </tr>
        </thead>
        <tbody>${csllRows}</tbody>
      </table>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>PIS/COFINS cumulativos</th>
            <th>Receita bruta</th>
            <th>ICMS excluído</th>
            <th>Monofásicos excluídos</th>
            <th>Base final</th>
            <th>PIS 0,65%</th>
            <th>COFINS 3%</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${pisRows}</tbody>
      </table>
    </div>
  `;
}

function buildExportPayload(calculation) {
  return {
    metadata: {
      aplicativo: "Dashboard Lucro Presumido 2026 - Comércio",
      regime: "Lucro Presumido",
      segmento: "Comércio",
      dataExportacao: new Date().toISOString(),
      observacoes: [
        "IRPJ com presunção de 8% e 8,8% no excedente trimestral/anual.",
        "CSLL com presunção de 12% e 13,2% a partir do 2º trimestre de 2026.",
        "Receitas financeiras entram integralmente na base de IRPJ/CSLL.",
        "PIS/COFINS cumulativos usam base operacional com exclusão de ICMS informado e monofásicos.",
      ],
    },
    annual: calculation.annual,
    quarters: calculation.quarterResults,
  };
}

function exportXml() {
  const calculation = calculateAll();
  const payload = buildExportPayload(calculation);
  const xml = toXml(payload);
  downloadFile(`lucro-presumido-comercio-2026-${timestampForFile()}.xml`, xml, "application/xml;charset=utf-8");
}

function toXml(payload) {
  const quartersXml = payload.quarters
    .map(
      (quarter) => `
    <trimestre id="${escapeXml(quarter.quarterLabel)}">
      <receitaBruta>${quarter.grossRevenue.toFixed(2)}</receitaBruta>
      <deducoesOperacionais>${quarter.returns.toFixed(2)}</deducoesOperacionais>
      <receitaOperacional>${quarter.operationalRevenue.toFixed(2)}</receitaOperacional>
      <receitaFinanceira>${quarter.financialRevenue.toFixed(2)}</receitaFinanceira>
      <irrfMensalAcumulado>${quarter.withheldIr.toFixed(2)}</irrfMensalAcumulado>
      <icmsInformado>${quarter.icmsAmount.toFixed(2)}</icmsInformado>
      <receitaMonofasica>${quarter.monophaseRevenue.toFixed(2)}</receitaMonofasica>
      <basePisCofins>${quarter.pisCofins.base.toFixed(2)}</basePisCofins>
      <irpj>
        <excessoOriginal>${quarter.irpj.original.excess.toFixed(2)}</excessoOriginal>
        <excessoFinal>${quarter.irpj.final.excess.toFixed(2)}</excessoFinal>
        <baseTotal>${quarter.irpj.final.baseTotal.toFixed(2)}</baseTotal>
        <tributo>${quarter.irpj.final.grossTax.toFixed(2)}</tributo>
        <credito>${quarter.irpj.credit.toFixed(2)}</credito>
      </irpj>
      <csll>
        <excessoOriginal>${quarter.csll.original.excess.toFixed(2)}</excessoOriginal>
        <excessoFinal>${quarter.csll.final.excess.toFixed(2)}</excessoFinal>
        <baseTotal>${quarter.csll.final.baseTotal.toFixed(2)}</baseTotal>
        <tributo>${quarter.csll.final.grossTax.toFixed(2)}</tributo>
        <credito>${quarter.csll.credit.toFixed(2)}</credito>
      </csll>
      <pisCofins>
        <pis>${quarter.pisCofins.pis.toFixed(2)}</pis>
        <cofins>${quarter.pisCofins.cofins.toFixed(2)}</cofins>
        <total>${quarter.pisCofins.total.toFixed(2)}</total>
      </pisCofins>
      <meses>
        ${quarter.months
          .map(
            (month) => `
        <mes nome="${escapeXml(month.name)}">
          <faturamentoBruto>${month.grossRevenue.toFixed(2)}</faturamentoBruto>
          <devolucoes>${month.returns.toFixed(2)}</devolucoes>
          <receitaFinanceira>${month.financialRevenue.toFixed(2)}</receitaFinanceira>
          <irrf>${month.withheldIrMonth.toFixed(2)}</irrf>
          <icms>${month.icmsAmount.toFixed(2)}</icms>
          <receitaMonofasica>${month.monophaseRevenue.toFixed(2)}</receitaMonofasica>
        </mes>`
          )
          .join("")}
      </meses>
    </trimestre>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<lucroPresumidoComercio2026>
  <metadata>
    <aplicativo>${escapeXml(payload.metadata.aplicativo)}</aplicativo>
    <regime>${escapeXml(payload.metadata.regime)}</regime>
    <segmento>${escapeXml(payload.metadata.segmento)}</segmento>
    <dataExportacao>${payload.metadata.dataExportacao}</dataExportacao>
  </metadata>
  <anual>
    <receitaBruta>${payload.annual.grossRevenue.toFixed(2)}</receitaBruta>
    <receitaOperacional>${payload.annual.operationalRevenue.toFixed(2)}</receitaOperacional>
    <receitaFinanceira>${payload.annual.financialRevenue.toFixed(2)}</receitaFinanceira>
    <irpjFinal>${payload.annual.irpjFinal.toFixed(2)}</irpjFinal>
    <csllFinal>${payload.annual.csllFinal.toFixed(2)}</csllFinal>
    <pis>${payload.annual.pis.toFixed(2)}</pis>
    <cofins>${payload.annual.cofins.toFixed(2)}</cofins>
    <creditoIrpj>${payload.annual.irpjCredit.toFixed(2)}</creditoIrpj>
    <creditoCsll>${payload.annual.csllCredit.toFixed(2)}</creditoCsll>
  </anual>
  <trimestres>${quartersXml}
  </trimestres>
</lucroPresumidoComercio2026>`;
}

function exportPdf() {
  const calculation = calculateAll();
  const printWindow = window.open("", "_blank", "width=1200,height=900");
  if (!printWindow) {
    alert("Seu navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente.");
    return;
  }

  printWindow.document.write(`
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Relatório Lucro Presumido 2026</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #142033; }
          h1, h2 { margin-bottom: 8px; }
          .note { color: #5a6678; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th, td { border: 1px solid #dbe4ef; padding: 8px; text-align: right; }
          th:first-child, td:first-child { text-align: left; }
          th { background: #f7faff; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
          .card { border: 1px solid #dbe4ef; border-radius: 12px; padding: 14px; }
          .card strong { display: block; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <h1>Relatório de Lucro Presumido 2026 - Comércio</h1>
        <p class="note">Relatório preparado para exportação em PDF via impressão do navegador.</p>
        <div class="grid">
          <div class="card"><strong>Receita bruta anual</strong>${formatCurrency(calculation.annual.grossRevenue)}</div>
          <div class="card"><strong>IRPJ reapurado</strong>${formatCurrency(calculation.annual.irpjFinal)}</div>
          <div class="card"><strong>CSLL reapurada</strong>${formatCurrency(calculation.annual.csllFinal)}</div>
          <div class="card"><strong>PIS</strong>${formatCurrency(calculation.annual.pis)}</div>
          <div class="card"><strong>COFINS</strong>${formatCurrency(calculation.annual.cofins)}</div>
          <div class="card"><strong>Crédito IRPJ + CSLL</strong>${formatCurrency(calculation.annual.irpjCredit + calculation.annual.csllCredit)}</div>
        </div>
        ${document.getElementById("recalcTables").innerHTML}
        ${document.getElementById("detailedOutput").innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function timestampForFile() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
}

document.getElementById("recalculateBtn").addEventListener("click", () => renderApp());
document.getElementById("exportXmlBtn").addEventListener("click", exportXml);
document.getElementById("exportPdfBtn").addEventListener("click", exportPdf);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!window.confirm("Deseja limpar todos os dados informados?")) return;
  state = createDefaultState();
  saveState();
  renderApp();
});

renderApp();
