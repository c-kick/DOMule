import {logger, DEBUG} from './core.log.mjs';

export const NAME = 'core.telemetry';

/** @type {boolean} Telemetry flag - disabled when telemetry=false in URL */
const NO_TELEMETRY = DEBUG && (typeof window !== 'undefined' && window.location.search.includes('telemetry=false'));

class Telemetry {
    constructor() {
        this._enabled = DEBUG;
        this._budget = this._loadBudget();
        this._session = {
            modules: new Map(),
            pageLoads: 0,
            totalBytes: 0,
            violations: []
        };
    }

    _loadBudget() {
        // Read from meta tag or config file
        const meta = document.querySelector('meta[name="domule-budget"]');
        return meta ? JSON.parse(meta.content) : {
            maxModuleSize: 50 * 1024,      // 50KB per module
            maxPageSize: 200 * 1024,       // 200KB total per page
            maxModules: 10,                 // 10 modules per page
            warnThreshold: 0.8              // Warn at 80% budget
        };
    }

    recordModuleLoad(name, data) {
        const entry = {
            name,
            size: parseInt(data.size) || 0,
            duration: data.duration,
            elements: data.elements,
            timestamp: performance.now(),
            url: data.url
        };

        this._session.modules.set(name, entry);
        this._session.totalBytes += entry.size;

        // Check budget violations
        this._checkBudget(entry);

        // Update dashboard if open
        this._updateDashboard();
    }

    _checkBudget(entry) {
        const violations = [];

        // Per-module size check
        if (entry.size > this._budget.maxModuleSize) {
            violations.push({
                type: 'module-size',
                module: entry.name,
                actual: entry.size,
                budget: this._budget.maxModuleSize,
                severity: 'error'
            });
        }

        // Warn threshold
        if (entry.size > this._budget.maxModuleSize * this._budget.warnThreshold) {
            violations.push({
                type: 'module-size',
                module: entry.name,
                actual: entry.size,
                budget: this._budget.maxModuleSize,
                severity: 'warning'
            });
        }

        // Page budget check
        if (this._session.totalBytes > this._budget.maxPageSize) {
            violations.push({
                type: 'page-size',
                actual: this._session.totalBytes,
                budget: this._budget.maxPageSize,
                severity: 'error'
            });
        }

        // Module count check
        if (this._session.modules.size > this._budget.maxModules) {
            violations.push({
                type: 'module-count',
                actual: this._session.modules.size,
                budget: this._budget.maxModules,
                severity: 'warning'
            });
        }

        violations.forEach(v => {
            this._session.violations.push(v);
            this._logViolation(v);
        });
    }

    _logViolation(violation) {
        const formatter = {
            'module-size': (v) =>
                `Module '${v.module}' (${(v.actual/1024).toFixed(1)}KB) exceeds budget (${(v.budget/1024).toFixed(1)}KB)`,
            'page-size': (v) =>
                `Page total (${(v.actual/1024).toFixed(1)}KB) exceeds budget (${(v.budget/1024).toFixed(1)}KB)`,
            'module-count': (v) =>
                `Module count (${v.actual}) exceeds budget (${v.budget})`
        };

        const msg = formatter[violation.type](violation);

        if (violation.severity === 'error') {
            logger.error(NAME, msg);
        } else {
            logger.warn(NAME, msg);
        }
    }

    getReport() {
        return {
            session: this._session,
            budget: this._budget,
            utilization: {
                bytes: (this._session.totalBytes / this._budget.maxPageSize * 100).toFixed(1),
                modules: (this._session.modules.size / this._budget.maxModules * 100).toFixed(1)
            },
            violations: this._session.violations
        };
    }

    // Dashboard (floating panel)
    _updateDashboard() {
        if (!this._dashboard) return;

        const report = this.getReport();
        this._dashboard.querySelector('.total-bytes').textContent =
            `${(report.session.totalBytes/1024).toFixed(1)}KB / ${(report.budget.maxPageSize/1024).toFixed(1)}KB`;
        this._dashboard.querySelector('.module-count').textContent =
            `${report.session.modules.size} / ${report.budget.maxModules}`;
        this._dashboard.querySelector('.violations').textContent =
            report.violations.length;
    }

    showDashboard() {
        if (this._dashboard) return;

        this._dashboard = document.createElement('div');
        this._dashboard.className = 'domule-telemetry';
        this._dashboard.style.position = 'fixed';
        this._dashboard.style.right = '0';
        this._dashboard.style.bottom = '0';
        this._dashboard.style.zIndex = "99999";
        this._dashboard.style.background = "#000A";
        this._dashboard.style.color = "#FFF";
        this._dashboard.style.padding = "15px";
        this._dashboard.style.fontSize = "12px";

        this._dashboard.innerHTML = `
            <div class="header"><strong>DOMule Telemetry</strong></div>
            <div class="stats">
                <div>Bytes: <span class="total-bytes">-</span></div>
                <div>Modules: <span class="module-count">-</span></div>
                <div>Violations: <span class="violations">0</span></div>
            </div>
            <button class="export" style="font-size: 12px;padding: 5px 8px;">Export JSON</button>
        `;

        this._dashboard.querySelector('.export').addEventListener('click', () => {
            const report = this.getReport();
            const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `domule-telemetry-${Date.now()}.json`;
            a.click();
        });

        document.body.appendChild(this._dashboard);
        this._updateDashboard();
    }

    isEnabled() {
        return this._enabled;
    }
}

export const telemetry = new Telemetry();

// Auto-show dashboard if enabled
if (telemetry.isEnabled() && !NO_TELEMETRY) {
    window.addEventListener('load', () => {
        telemetry.showDashboard();
    });
}