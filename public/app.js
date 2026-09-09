/**
 * CodeHeal X — Autonomous Backend Repair Engineer
 * Frontend Application Logic
 *
 * Architecture:
 *   state        — single source of truth
 *   UI helpers   — DOM manipulation utilities
 *   Terminal     — live agent console output
 *   Progress     — repair pipeline tracker
 *   Repair       — main orchestrator
 *   Events       — input event wiring
 */

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    isRepairing: false,
    hasResult:   false,
    brokenCode:  "",
};

// ─── DOM References ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
    apiKey:          $("apiKey"),
    toggleApiKey:    $("toggleApiKey"),
    eyeIcon:         $("eyeIcon"),
    brokenCode:      $("brokenCode"),
    errorLog:        $("errorLog"),
    codeMeta:        $("codeMeta"),
    codeLines:       $("codeLines"),
    logLines:        $("logLines"),
    repairBtn:       $("repairBtn"),
    repairBtnText:   $("repairBtnText"),
    loadDemoBtn:     $("loadDemoBtn"),
    resetBtn:        $("resetBtn"),

    progressSection: $("progressSection"),
    terminalSection: $("terminalSection"),
    terminalLines:   $("terminalLines"),
    termCursor:      $("termCursor"),
    terminalBody:    $("terminalBody"),

    errorBanner:     $("errorBanner"),
    errorTitle:      $("errorTitle"),
    errorMsg:        $("errorMsg"),
    errorClose:      $("errorClose"),

    resultsSection:  $("resultsSection"),
    rootCauseText:   $("rootCauseText"),
    fixedCode:       $("fixedCode"),
    lineNumbers:     $("lineNumbers"),
    copyBtn:         $("copyBtn"),
    beforeCode:      $("beforeCode"),
    afterCode:       $("afterCode"),

    pnodes: {
        scan:     $("pnode-scan"),
        analyze:  $("pnode-analyze"),
        patch:    $("pnode-patch"),
        test:     $("pnode-test"),
        verified: $("pnode-verified"),
    },
    pconns: {
        1: $("pconn-1"),
        2: $("pconn-2"),
        3: $("pconn-3"),
        4: $("pconn-4"),
    },
};

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_CODE = `package com.example.ecommerce.service;

import com.example.ecommerce.model.Order;
import com.example.ecommerce.repository.OrderRepository;
import com.example.ecommerce.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Creates a new order for a given user.
     * @param userId  The ID of the user placing the order.
     * @param productId  The product to order.
     * @param quantity  Number of units.
     * @return The saved Order entity.
     */
    public Order createOrder(Long userId, Long productId, int quantity) {
        // Fetch user to validate existence
        var user = userRepository.findById(userId);

        Order order = new Order();
        order.setUserId(userId);
        order.setProductId(productId);
        order.setQuantity(quantity);

        // Apply discount for premium users
        if (user.isPremium()) {
            order.setDiscount(0.15);
        }

        return orderRepository.save(order);
    }

    /**
     * Cancels an existing order.
     * @param orderId The order to cancel.
     */
    public void cancelOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));
        order.setStatus("CANCELLED");
        orderRepository.save(order);
    }
}`;

const DEMO_LOG = `java.lang.NullPointerException: Cannot invoke "com.example.ecommerce.model.User.isPremium()" because "user" is null
	at com.example.ecommerce.service.OrderService.createOrder(OrderService.java:32)
	at com.example.ecommerce.controller.OrderController.placeOrder(OrderController.java:45)
	at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
	at org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)

Failed tests:
  OrderServiceTest > testCreateOrderForExistingUser FAILED
    NullPointerException at OrderService.java:32

  OrderServiceTest > testCreateOrderWithPremiumDiscount FAILED
    NullPointerException at OrderService.java:32

2 tests failed, 0 passed.`;

// ─── Utility: async sleep ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Utility: get current time string ─────────────────────────────────────────
function timestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    return `[${h}:${m}:${s}]`;
}

// ─── Terminal ─────────────────────────────────────────────────────────────────
function termClear() {
    els.terminalLines.innerHTML = "";
}

function termWrite(message, cssClass = "") {
    const line = document.createElement("div");
    line.className = "terminal-line";

    const ts = document.createElement("span");
    ts.className = "term-ts";
    ts.textContent = timestamp();

    const msg = document.createElement("span");
    msg.className = `term-msg${cssClass ? " " + cssClass : ""}`;
    msg.textContent = message;

    line.appendChild(ts);
    line.appendChild(msg);
    els.terminalLines.appendChild(line);

    // Auto-scroll to bottom
    els.terminalBody.scrollTop = els.terminalBody.scrollHeight;
}

// ─── Progress Pipeline ────────────────────────────────────────────────────────
function progressReset() {
    Object.values(els.pnodes).forEach((n) => {
        n.classList.remove("active", "done");
    });
    Object.values(els.pconns).forEach((c) => {
        c.classList.remove("done");
    });
}

function progressActivate(nodeKey) {
    const node = els.pnodes[nodeKey];
    if (node) {
        node.classList.remove("done");
        node.classList.add("active");
    }
}

function progressDone(nodeKey, connKey) {
    const node = els.pnodes[nodeKey];
    if (node) {
        node.classList.remove("active");
        node.classList.add("done");
    }
    if (connKey && els.pconns[connKey]) {
        els.pconns[connKey].classList.add("done");
    }
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
function showError(title, message) {
    els.errorTitle.textContent = title;
    els.errorMsg.textContent   = message;
    els.errorBanner.classList.add("visible");
    els.errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
    els.errorBanner.classList.remove("visible");
}

// ─── Button States ────────────────────────────────────────────────────────────
function setRepairBtnLoading(loading) {
    els.repairBtn.disabled = loading;
    if (loading) {
        els.repairBtnText.textContent = "REPAIR AGENT RUNNING...";
        els.repairBtn.querySelector(".btn-icon").textContent = "◌";
    } else {
        els.repairBtnText.textContent = "START AUTONOMOUS REPAIR";
        els.repairBtn.querySelector(".btn-icon").textContent = "⚡";
    }
}

// ─── Line Numbers ─────────────────────────────────────────────────────────────
function updateLineNumbers(textarea, linesEl) {
    const lines  = textarea.value.split("\n").length;
    const maxLen = String(lines).length;
    let html = "";
    for (let i = 1; i <= lines; i++) {
        html += `<span>${String(i).padStart(maxLen, " ")}</span>`;
    }
    linesEl.innerHTML = html;
}

function updateCodeMeta(textarea) {
    const lines = textarea.value.split("\n").length;
    // Very basic language detection
    let lang = "Auto-detect";
    const val = textarea.value;
    if (val.includes("package ") && val.includes("import ")) lang = "Java";
    else if (val.includes("def ") && val.includes("import ")) lang = "Python";
    else if (val.includes("function") && val.includes("const ")) lang = "JavaScript";
    else if (val.includes("using ") && val.includes("namespace")) lang = "C#";
    else if (val.includes("fn ") && val.includes("let mut")) lang = "Rust";
    else if (val.includes("#include")) lang = "C/C++";

    els.codeMeta.textContent = `Language: ${lang} · Lines: ${lines}`;
}

// ─── Simple Syntax Highlighter ────────────────────────────────────────────────
function highlight(code) {
    // Escape HTML first
    const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    return escaped
        // Line comments //...
        .replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>')
        // Block comments /* ... */
        .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
        // Annotations @Something
        .replace(/(@\w+)/g, '<span class="tok-annot">$1</span>')
        // String literals (double/single quotes, simplified)
        .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="tok-string">$1</span>')
        .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="tok-string">$1</span>')
        // Keywords
        .replace(
            /\b(public|private|protected|static|final|void|class|interface|extends|implements|new|return|if|else|for|while|try|catch|throw|throws|import|package|var|let|const|function|async|await|def|self|from|in|not|and|or|True|False|None|null|true|false|this|super|abstract|override|namespace|using|struct|enum)\b/g,
            '<span class="tok-keyword">$1</span>'
        )
        // Types / capitalized identifiers
        .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span class="tok-type">$1</span>')
        // Numbers
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-number">$1</span>');
}

function renderHighlightedCode(el, code) {
    el.innerHTML = highlight(code);
}

function renderLineNumbers(el, code) {
    const lines  = code.split("\n");
    const maxLen = String(lines.length).length;
    el.innerHTML = lines
        .map((_, i) => String(i + 1).padStart(maxLen, " "))
        .join("\n");
}

// ─── Main Repair Sequence ─────────────────────────────────────────────────────
/**
 * runRepairSequence — orchestrates the full autonomous repair experience.
 * Real Anthropic call happens at step 3 (AI analysis).
 * Steps 5-8 are simulated post-AI verification stages.
 */
async function runRepairSequence(apiKey, brokenCode, errorLog) {
    // Show UI panels
    els.progressSection.classList.add("visible");
    els.terminalSection.classList.add("visible");
    els.resultsSection.classList.remove("visible");
    hideError();
    termClear();
    progressReset();

    // ─── [01] INITIALIZING ────────────────────────────────────────────────
    progressActivate("scan");
    termWrite("[01] Initializing repair agent...", "accent");
    await sleep(600);
    termWrite("Loading Claude AI engine...", "dim");
    await sleep(500);
    termWrite("Security context: session-only, no persistence.", "dim");
    await sleep(400);

    // ─── [02] SCANNING ────────────────────────────────────────────────────
    termWrite("[02] Scanning source code...", "accent");
    const lineCount = brokenCode.split("\n").length;
    await sleep(500);
    termWrite(`Found ${lineCount} lines. Tokenizing...`, "dim");
    await sleep(700);
    termWrite("Parsing symbol table and call graph...", "dim");
    await sleep(600);
    progressDone("scan", 1);
    progressActivate("analyze");

    // ─── [03] ANALYZING — REAL AI CALL ───────────────────────────────────
    termWrite("[03] Analyzing failure signals with Claude AI...", "warning");
    await sleep(400);
    termWrite("Sending code + error log to AI engine...", "dim");
    await sleep(300);

    let result;
    try {
        const response = await fetch("/api/repair", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey, brokenCode, errorLog }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw { status: response.status, message: data.error || "Unknown error from AI engine." };
        }

        result = data;
    } catch (err) {
        // Handle specific known error codes
        const msg = err.message || "";
        let title, userMsg;

        if (err.status === 401 || msg === "AI_AUTH_FAILED") {
            title   = "AI AUTHENTICATION FAILED";
            userMsg = "The provided Anthropic API key was rejected. Please verify the key and try again.";
        } else if (err.status === 429 || msg === "AI_RATE_LIMITED") {
            title   = "AI ENGINE RATE LIMITED";
            userMsg = "The AI engine is currently rate limited. Please wait a moment and try again.";
        } else if (!navigator.onLine || msg.toLowerCase().includes("failed to fetch")) {
            title   = "CONNECTION FAILED";
            userMsg = "Unable to reach the AI engine. Check your connection and retry.";
        } else if (msg.includes("invalid repair response")) {
            title   = "REPAIR AGENT ERROR";
            userMsg = "The AI returned an invalid repair response. Please retry.";
        } else if (msg.includes("API key")) {
            title   = "API KEY REQUIRED";
            userMsg = msg;
        } else {
            title   = "REPAIR FAILED";
            userMsg = msg || "An unexpected error occurred. Please retry.";
        }

        termWrite(`✕ Error: ${title}`, "warning");
        showError(title, userMsg);
        setRepairBtnLoading(false);
        state.isRepairing = false;
        progressReset();
        return;
    }

    termWrite("Root cause identification complete.", "success");
    await sleep(400);
    progressDone("analyze", 2);
    progressActivate("patch");

    // ─── [04] PATCH GENERATED ─────────────────────────────────────────────
    termWrite("[04] Generating patch...", "accent");
    await sleep(500);
    termWrite("Patch generated. Analyzing diff...", "dim");
    await sleep(600);
    termWrite("[SIMULATED] Compiling patched code with javac...", "simulated");
    await sleep(900);
    termWrite("[SIMULATED] Compilation successful — 0 errors, 0 warnings.", "simulated");
    progressDone("patch", 3);
    progressActivate("test");

    // ─── [05] VALIDATING PATCH ────────────────────────────────────────────
    termWrite("[05] Validating patch...", "accent");
    await sleep(500);
    termWrite("Static analysis: no new issues introduced.", "dim");
    await sleep(400);
    termWrite("[SIMULATED] Patch validation passed.", "simulated");
    await sleep(400);

    // ─── [06] RUNNING TEST SUITE ──────────────────────────────────────────
    termWrite("[06] Running test suite... [SIMULATED TEST ENVIRONMENT]", "warning");
    await sleep(700);
    termWrite("[SIMULATED] Maven test runner initialized...", "simulated");
    await sleep(600);
    termWrite("[SIMULATED] Running unit tests...", "simulated");
    await sleep(1000);
    termWrite("[SIMULATED] Running integration tests...", "simulated");
    await sleep(800);
    progressDone("test", 4);
    progressActivate("verified");

    // ─── [07] TESTS PASSED ────────────────────────────────────────────────
    termWrite("[07] 47/47 tests passed. [SIMULATED]", "success");
    await sleep(400);
    termWrite("[08] ✓ REPAIR VERIFIED", "success");
    await sleep(300);
    progressDone("verified");

    // ─── Reveal Results ───────────────────────────────────────────────────
    renderResults(result.rootCause, result.patchedCode, brokenCode);
    setRepairBtnLoading(false);
    state.isRepairing = false;
    state.hasResult   = true;
    els.resultsSection.classList.add("visible");

    // Smooth scroll to results
    await sleep(200);
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Render Results ───────────────────────────────────────────────────────────
function renderResults(rootCause, patchedCode, originalCode) {
    // Root cause
    els.rootCauseText.textContent = rootCause;

    // Before / After
    renderHighlightedCode(els.beforeCode, originalCode);
    renderHighlightedCode(els.afterCode, patchedCode);

    // Fixed code viewer
    renderHighlightedCode(els.fixedCode, patchedCode);
    renderLineNumbers(els.lineNumbers, patchedCode);
}

// ─── Repair Entry Point ───────────────────────────────────────────────────────
async function startRepair() {
    if (state.isRepairing) return;

    hideError();

    const apiKey    = els.apiKey.value.trim();
    const brokenCode = els.brokenCode.value.trim();
    const errorLog  = els.errorLog.value.trim();

    // Client-side validation
    if (!apiKey) {
        showError(
            "API KEY REQUIRED",
            "Connect an Anthropic API key to start the repair agent."
        );
        els.apiKey.focus();
        return;
    }

    if (!brokenCode) {
        showError("SOURCE CODE REQUIRED", "Paste your broken backend source code to begin.");
        els.brokenCode.focus();
        return;
    }

    if (!errorLog) {
        showError("ERROR LOG REQUIRED", "Paste a stack trace, exception, or failed test output.");
        els.errorLog.focus();
        return;
    }

    state.isRepairing = true;
    state.brokenCode  = brokenCode;
    setRepairBtnLoading(true);

    await runRepairSequence(apiKey, brokenCode, errorLog);
}

// ─── Reset Session ────────────────────────────────────────────────────────────
function resetSession() {
    // Clear inputs
    els.apiKey.value    = "";
    els.brokenCode.value = "";
    els.errorLog.value  = "";

    // Reset state
    state.isRepairing = false;
    state.hasResult   = false;
    state.brokenCode  = "";

    // Reset UI
    setRepairBtnLoading(false);
    hideError();
    termClear();
    progressReset();

    // Hide sections
    els.progressSection.classList.remove("visible");
    els.terminalSection.classList.remove("visible");
    els.resultsSection.classList.remove("visible");

    // Reset line numbers
    updateLineNumbers(els.brokenCode, els.codeLines);
    updateLineNumbers(els.errorLog, els.logLines);
    updateCodeMeta(els.brokenCode);

    // Reset copy button
    els.copyBtn.textContent = "COPY CODE";
    els.copyBtn.classList.remove("copied");

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── Load Demo Bug ────────────────────────────────────────────────────────────
function loadDemo() {
    els.brokenCode.value = DEMO_CODE;
    els.errorLog.value   = DEMO_LOG;
    updateLineNumbers(els.brokenCode, els.codeLines);
    updateLineNumbers(els.errorLog, els.logLines);
    updateCodeMeta(els.brokenCode);

    // Scroll into view for the user to see the populated fields
    els.brokenCode.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ─── Copy Fixed Code ──────────────────────────────────────────────────────────
function copyFixedCode() {
    const code = els.fixedCode.textContent;
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
        els.copyBtn.textContent = "COPIED ✓";
        els.copyBtn.classList.add("copied");
        setTimeout(() => {
            els.copyBtn.textContent = "COPY CODE";
            els.copyBtn.classList.remove("copied");
        }, 2000);
    }).catch(() => {
        // Fallback for browsers without clipboard API
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity  = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        els.copyBtn.textContent = "COPIED ✓";
        els.copyBtn.classList.add("copied");
        setTimeout(() => {
            els.copyBtn.textContent = "COPY CODE";
            els.copyBtn.classList.remove("copied");
        }, 2000);
    });
}

// ─── Toggle API Key Visibility ────────────────────────────────────────────────
function toggleApiKeyVisibility() {
    if (els.apiKey.type === "password") {
        els.apiKey.type      = "text";
        els.eyeIcon.textContent = "🙈";
    } else {
        els.apiKey.type      = "password";
        els.eyeIcon.textContent = "👁";
    }
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────
function initEvents() {
    els.repairBtn.addEventListener("click", startRepair);
    els.loadDemoBtn.addEventListener("click", loadDemo);
    els.resetBtn.addEventListener("click", resetSession);
    els.copyBtn.addEventListener("click", copyFixedCode);
    els.toggleApiKey.addEventListener("click", toggleApiKeyVisibility);
    els.errorClose.addEventListener("click", hideError);

    // Live line number updates
    els.brokenCode.addEventListener("input", () => {
        updateLineNumbers(els.brokenCode, els.codeLines);
        updateCodeMeta(els.brokenCode);
    });

    els.errorLog.addEventListener("input", () => {
        updateLineNumbers(els.errorLog, els.logLines);
    });

    // Prevent Enter from triggering repair unexpectedly
    els.apiKey.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            startRepair();
        }
    });

    // Tab support in textareas for code indentation
    [els.brokenCode, els.errorLog].forEach((ta) => {
        ta.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                const start = ta.selectionStart;
                const end   = ta.selectionEnd;
                ta.value = ta.value.substring(0, start) + "  " + ta.value.substring(end);
                ta.selectionStart = ta.selectionEnd = start + 2;
                updateLineNumbers(ta, ta === els.brokenCode ? els.codeLines : els.logLines);
            }
        });
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
    initEvents();

    // Initial line numbers
    updateLineNumbers(els.brokenCode, els.codeLines);
    updateLineNumbers(els.errorLog, els.logLines);
    updateCodeMeta(els.brokenCode);

    // Health check — verify server is alive
    fetch("/api/health")
        .then((r) => r.json())
        .then((d) => {
            if (d.status === "online") {
                console.log(`[CodeHeal X] Engine online. Model: ${d.model}`);
            }
        })
        .catch(() => {
            // Server might not be running — fail silently in UI
        });
}

document.addEventListener("DOMContentLoaded", init);
