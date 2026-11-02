const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'ui', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Inserir getCategoryBadgeHtml logo antes de renderTransactionRow
const oldBeforeRow = `function renderTransactionRow(tx) {`;
const newBeforeRow = `function getCategoryBadgeHtml(cat) {
  if (!cat) return \`<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); font-weight: 600;">Geral</span>\`;
  const iconName = cat.icon || 'tag';
  const color = cat.color || '#6366f1';
  return \`
    <span class="badge badge-cat" style="background: \${color}18; color: \${color}; border: 1px solid \${color}35; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; padding: 0.22rem 0.6rem; border-radius: 999px;">
      <i data-lucide="\${iconName}" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
      <span>\${escapeHtml(cat.name)}</span>
    </span>
  \`;
}

function renderTransactionRow(tx) {`;

// 2. Substituir a célula de categoria em renderTransactionRow
const oldCatCell = `      <td class="tx-cell-cat">
        \${isVaultTx ? \`
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="piggy-bank" style="width: 12px; height: 12px;"></i> Cofrinho / Reserva
          </span>
        \` : \`
          <span class="badge badge-cat">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:\${cat.color}"></span>
            \${cat.name}
          </span>
        \`}
      </td>`;

const newCatCell = `      <td class="tx-cell-cat">
        \${isVaultTx ? \`
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="piggy-bank" style="width: 12px; height: 12px;"></i> Cofrinho / Reserva
          </span>
        \` : getCategoryBadgeHtml(cat)}
      </td>`;

// 3. Adicionar lógica de sugestão preditiva para txModal e schModal
const oldSetupModalsEnd = `  // Configuração das Abas do Modal de Detalhes da Métrica`;
const newSuggestionsCode = `  // =========================================================================
  // --- MOTOR DE SUGESTÕES PREDITIVAS E AUTO-CATEGORIZAÇÃO INTELIGENTE ---
  // =========================================================================
  window.applyTxSuggestion = function(desc, catId, accId) {
    const inDesc = document.getElementById('txDesc');
    const inCat = document.getElementById('txCategory');
    const inAcc = document.getElementById('txAccount');
    const cont = document.getElementById('txSuggestionsContainer');
    const badge = document.getElementById('txAutoCategoryBadge');

    if (inDesc) inDesc.value = desc;
    if (inCat && catId) inCat.value = catId;
    if (inAcc && accId) inAcc.value = accId;
    if (cont) cont.style.display = 'none';
    if (badge) {
      badge.innerHTML = \`✨ Preenchido com base no histórico!\`;
      badge.style.display = 'inline-flex';
      setTimeout(() => { if (badge) badge.style.display = 'none'; }, 2400);
    }
    const amt = document.getElementById('txAmount') || document.getElementById('txInstallmentAmount');
    if (amt) amt.focus();
  };

  window.applySchSuggestion = function(desc, catId, accId) {
    const inDesc = document.getElementById('schDesc');
    const inCat = document.getElementById('schCategory');
    const inAcc = document.getElementById('schAccount');
    const cont = document.getElementById('schSuggestionsContainer');
    const badge = document.getElementById('schAutoCategoryBadge');

    if (inDesc) inDesc.value = desc;
    if (inCat && catId) inCat.value = catId;
    if (inAcc && accId) inAcc.value = accId;
    if (cont) cont.style.display = 'none';
    if (badge) {
      badge.innerHTML = \`✨ Preenchido com base no histórico!\`;
      badge.style.display = 'inline-flex';
      setTimeout(() => { if (badge) badge.style.display = 'none'; }, 2400);
    }
    const amt = document.getElementById('schAmount');
    if (amt) amt.focus();
  };

  function setupSmartCategorySuggestions() {
    // 1. Campo de Descrição no Modal de Nova Transação (#txDesc)
    const txDescInput = document.getElementById('txDesc');
    const txSuggestions = document.getElementById('txSuggestionsContainer');
    const txCatBadge = document.getElementById('txAutoCategoryBadge');
    let txDebounce = null;

    if (txDescInput) {
      txDescInput.addEventListener('input', () => {
        clearTimeout(txDebounce);
        txDebounce = setTimeout(() => {
          const query = txDescInput.value.trim();
          if (query.length < 2) {
            if (txSuggestions) txSuggestions.style.display = 'none';
            if (txCatBadge) txCatBadge.style.display = 'none';
            return;
          }

          // Busca sugestões no histórico
          if (finance && typeof finance.getRecentDescriptionSuggestions === 'function') {
            const suggestions = finance.getRecentDescriptionSuggestions(query, currentTxType, 4);
            if (suggestions.length > 0 && txSuggestions) {
              txSuggestions.innerHTML = suggestions.map(s => {
                const safeDesc = s.description.replace(/"/g, '&quot;').replace(/'/g, "\\'");
                return \`
                  <button type="button" class="tx-suggestion-chip" onclick="window.applyTxSuggestion('\${safeDesc}', '\${s.categoryId || ''}', '\${s.accountId || ''}')" title="Auto-preencher: Categoria \${escapeHtml(s.categoryName)}">
                    <i data-lucide="\${s.categoryIcon}"></i>
                    <span>\${escapeHtml(s.description)}</span>
                    <span style="color: \${s.categoryColor}; font-size: 0.68rem; opacity: 0.85;">(\${escapeHtml(s.categoryName)})</span>
                  </button>
                \`;
              }).join('');
              txSuggestions.style.display = 'flex';
              if (window.lucide) lucide.createIcons({ root: txSuggestions });
            } else if (txSuggestions) {
              txSuggestions.style.display = 'none';
            }
          }

          // Auto-predição de categoria em tempo real
          if (finance && typeof finance.predictCategoryAndAccount === 'function') {
            const pred = finance.predictCategoryAndAccount(query, currentTxType);
            if (pred && pred.categoryId) {
              const catSelect = document.getElementById('txCategory');
              if (catSelect && catSelect.value !== pred.categoryId) {
                catSelect.value = pred.categoryId;
                if (txCatBadge) {
                  txCatBadge.innerHTML = \`✨ Categoria "\${escapeHtml(pred.categoryName)}" sugerida automaticamente\`;
                  txCatBadge.style.display = 'inline-flex';
                }
              }
              const accSelect = document.getElementById('txAccount');
              if (accSelect && pred.accountId && (!accSelect.value || accSelect.selectedIndex === 0)) {
                accSelect.value = pred.accountId;
              }
            }
          }
        }, 120);
      });
    }

    // 2. Campo de Descrição no Modal de Agendamentos (#schDesc)
    const schDescInput = document.getElementById('schDesc');
    const schSuggestions = document.getElementById('schSuggestionsContainer');
    const schCatBadge = document.getElementById('schAutoCategoryBadge');
    let schDebounce = null;

    if (schDescInput) {
      schDescInput.addEventListener('input', () => {
        clearTimeout(schDebounce);
        schDebounce = setTimeout(() => {
          const query = schDescInput.value.trim();
          const schTypeSelect = document.getElementById('schType');
          const schType = schTypeSelect ? schTypeSelect.value : 'expense';

          if (query.length < 2) {
            if (schSuggestions) schSuggestions.style.display = 'none';
            if (schCatBadge) schCatBadge.style.display = 'none';
            return;
          }

          if (finance && typeof finance.getRecentDescriptionSuggestions === 'function') {
            const suggestions = finance.getRecentDescriptionSuggestions(query, schType, 4);
            if (suggestions.length > 0 && schSuggestions) {
              schSuggestions.innerHTML = suggestions.map(s => {
                const safeDesc = s.description.replace(/"/g, '&quot;').replace(/'/g, "\\'");
                return \`
                  <button type="button" class="tx-suggestion-chip" onclick="window.applySchSuggestion('\${safeDesc}', '\${s.categoryId || ''}', '\${s.accountId || ''}')" title="Auto-preencher: Categoria \${escapeHtml(s.categoryName)}">
                    <i data-lucide="\${s.categoryIcon}"></i>
                    <span>\${escapeHtml(s.description)}</span>
                    <span style="color: \${s.categoryColor}; font-size: 0.68rem; opacity: 0.85;">(\${escapeHtml(s.categoryName)})</span>
                  </button>
                \`;
              }).join('');
              schSuggestions.style.display = 'flex';
              if (window.lucide) lucide.createIcons({ root: schSuggestions });
            } else if (schSuggestions) {
              schSuggestions.style.display = 'none';
            }
          }

          if (finance && typeof finance.predictCategoryAndAccount === 'function') {
            const pred = finance.predictCategoryAndAccount(query, schType);
            if (pred && pred.categoryId) {
              const catSelect = document.getElementById('schCategory');
              if (catSelect && catSelect.value !== pred.categoryId) {
                catSelect.value = pred.categoryId;
                if (schCatBadge) {
                  schCatBadge.innerHTML = \`✨ Categoria "\${escapeHtml(pred.categoryName)}" sugerida automaticamente\`;
                  schCatBadge.style.display = 'inline-flex';
                }
              }
              const accSelect = document.getElementById('schAccount');
              if (accSelect && pred.accountId && (!accSelect.value || accSelect.selectedIndex === 0)) {
                accSelect.value = pred.accountId;
              }
            }
          }
        }, 120);
      });
    }
  }

  // Configuração das Abas do Modal de Detalhes da Métrica`;

let norm = content.replace(/\r\n/g, '\n');

if (!norm.includes(oldBeforeRow.replace(/\r\n/g, '\n'))) {
  console.error('ERROR: oldBeforeRow not found');
  process.exit(1);
}
if (!norm.includes(oldCatCell.replace(/\r\n/g, '\n'))) {
  console.error('ERROR: oldCatCell not found');
  process.exit(1);
}
if (!norm.includes(oldSetupModalsEnd.replace(/\r\n/g, '\n'))) {
  console.error('ERROR: oldSetupModalsEnd not found');
  process.exit(1);
}

norm = norm.replace(oldBeforeRow.replace(/\r\n/g, '\n'), newBeforeRow.replace(/\r\n/g, '\n'));
norm = norm.replace(oldCatCell.replace(/\r\n/g, '\n'), newCatCell.replace(/\r\n/g, '\n'));
norm = norm.replace(oldSetupModalsEnd.replace(/\r\n/g, '\n'), newSuggestionsCode.replace(/\r\n/g, '\n'));

// Chamar setupSmartCategorySuggestions() dentro de setupModals()
const oldCallInSetupModals = `setupSalaryAlertsModal();`;
const newCallInSetupModals = `setupSalaryAlertsModal();\n    setupSmartCategorySuggestions();`;

norm = norm.replace(oldCallInSetupModals, newCallInSetupModals);

const finalContent = content.includes('\r\n') ? norm.replace(/\n/g, '\r\n') : norm;
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('SUCCESS: app.js atualizado com sucesso com ícones elegantes e auto-sugestões preditivas!');

