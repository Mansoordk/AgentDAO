"use client";

import { useEffect, useState } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";

const CONTRACT =
  "0x69e6f406C01bdA4AECCB5925896f0AbCe39de28b";

const EXPLORER =
  "https://explorer-studio.genlayer.com";

export default function Home() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [proposalUrl, setProposalUrl] = useState("");

  const [proposalId, setProposalId] = useState("");
  const [proposal, setProposal] = useState(null);

  const [governanceRules, setGovernanceRules] = useState("");
  const [newRules, setNewRules] = useState("");

  const [proposalCount, setProposalCount] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  function getClient() {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    return createClient({
      chain: studionet,
      account,
      provider: window.ethereum,
    });
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error("Please install MetaMask.");
      }

      setStatus("Connecting wallet...");

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts?.length) {
        throw new Error("No wallet account found.");
      }

      setAccount(accounts[0]);
      setStatus("Wallet connected successfully.");
    } catch (error) {
      setStatus(error?.message || "Failed to connect wallet.");
    }
  }

  async function writeContract(functionName, args = []) {
    if (!account) {
      throw new Error("Connect your wallet first.");
    }

    const client = getClient();

    const hash = await client.writeContract({
      address: CONTRACT,
      functionName,
      args,
    });

    await client.waitForTransactionReceipt({
      hash,
    });

    return hash;
  }

  async function createProposal() {
    try {
      if (!title.trim()) {
        throw new Error("Enter a proposal title.");
      }

      if (!description.trim()) {
        throw new Error("Enter a proposal description.");
      }

      if (!requestedAmount.trim()) {
        throw new Error("Enter the requested amount.");
      }

      setLoading(true);
      setStatus("Submitting proposal to GenLayer...");

      const amount =
        BigInt(Math.floor(Number(requestedAmount))) *
        10n ** 18n;

      const hash = await writeContract("create_proposal", [
        title.trim(),
        description.trim(),
        amount,
        proposalUrl.trim(),
      ]);

      setStatus(
        `Proposal submitted successfully. Transaction: ${hash}`
      );

      setTitle("");
      setDescription("");
      setRequestedAmount("");
      setProposalUrl("");

      await loadProposalCount();
      setActiveTab("dashboard");
    } catch (error) {
      setStatus(error?.message || "Failed to create proposal.");
    } finally {
      setLoading(false);
    }
  }

  async function evaluateProposal() {
    try {
      if (!proposalId.trim()) {
        throw new Error("Enter a proposal ID.");
      }

      setLoading(true);
      setStatus(
        "GenLayer validators are independently evaluating the proposal..."
      );

      const hash = await writeContract("evaluate_proposal", [
        Number(proposalId),
      ]);

      setStatus(
        `Evaluation finalized. Transaction: ${hash}`
      );

      await loadProposal();
    } catch (error) {
      setStatus(error?.message || "Failed to evaluate proposal.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProposal() {
    try {
      if (!proposalId.trim()) {
        throw new Error("Enter a proposal ID.");
      }

      setLoading(true);
      setStatus("Loading proposal from GenLayer...");

      const client = getClient();

      const result = await client.readContract({
        address: CONTRACT,
        functionName: "get_proposal",
        args: [Number(proposalId)],
        transactionHashVariant:
          TransactionHashVariant.LATEST_FINAL,
      });

      setProposal(result);
      setStatus("Proposal loaded.");
    } catch (error) {
      setStatus(error?.message || "Failed to load proposal.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProposalCount() {
    try {
      const client = getClient();

      const result = await client.readContract({
        address: CONTRACT,
        functionName: "get_proposal_count",
        args: [],
        transactionHashVariant:
          TransactionHashVariant.LATEST_FINAL,
      });

      setProposalCount(Number(result));
    } catch {
      // Dashboard statistics are optional.
    }
  }

  async function loadGovernanceRules() {
    try {
      const client = getClient();

      const result = await client.readContract({
        address: CONTRACT,
        functionName: "get_governance_rules",
        args: [],
        transactionHashVariant:
          TransactionHashVariant.LATEST_FINAL,
      });

      setGovernanceRules(
        result || "No governance rules configured."
      );
    } catch (error) {
      setStatus(
        error?.message || "Failed to load governance rules."
      );
    }
  }

  async function updateGovernanceRules() {
    try {
      if (!newRules.trim()) {
        throw new Error("Enter governance rules.");
      }

      setLoading(true);
      setStatus("Updating governance rules...");

      const hash = await writeContract("set_governance_rules", [
        newRules.trim(),
      ]);

      setGovernanceRules(newRules.trim());
      setNewRules("");

      setStatus(
        `Governance rules updated. Transaction: ${hash}`
      );
    } catch (error) {
      setStatus(
        error?.message || "Failed to update governance rules."
      );
    } finally {
      setLoading(false);
    }
  }

  function openProposal(id) {
    setProposalId(String(id));
    setActiveTab("evaluate");

    setTimeout(() => {
      loadProposal();
    }, 100);
  }

  useEffect(() => {
    if (!window.ethereum) return;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts?.length) {
          setAccount(accounts[0]);
        }
      });

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts?.[0] || "");
    };

    window.ethereum.on(
      "accountsChanged",
      handleAccountsChanged
    );

    return () => {
      window.ethereum.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );
    };
  }, []);

  useEffect(() => {
    if (account) {
      loadProposalCount();
      loadGovernanceRules();
    }
  }, [account]);

  const currentVerdict =
    proposal?.verdict?.toString?.() ||
    proposal?.verdict ||
    "";

  const currentStatus =
    proposal?.status?.toString?.() ||
    proposal?.status ||
    "";

  const currentScore =
    proposal?.score !== undefined
      ? Number(proposal.score)
      : 0;

  const isApproved =
    currentVerdict === "APPROVED";

  const isRejected =
    currentVerdict === "REJECTED";

  return (
    <main className="app-shell">
      <div className="background-grid" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            AD
          </div>

          <div>
            <div className="brand-name">
              AgentDAO
            </div>
            <div className="brand-sub">
              Intelligent Governance
            </div>
          </div>
        </div>

        <div className="network-pill">
          <span className="live-dot" />
          StudioNet
          <span className="chain-id">
            61999
          </span>
        </div>

        <button
          className="wallet-button"
          onClick={connectWallet}
        >
          <span>◉</span>
          {account
            ? `${account.slice(0, 6)}...${account.slice(-4)}`
            : "Connect Wallet"}
        </button>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <button
            className={
              activeTab === "dashboard"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setActiveTab("dashboard")}
          >
            <span>⌂</span>
            Dashboard
          </button>

          <button
            className={
              activeTab === "create"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setActiveTab("create")}
          >
            <span>＋</span>
            New Proposal
          </button>

          <button
            className={
              activeTab === "evaluate"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setActiveTab("evaluate")}
          >
            <span>◈</span>
            Evaluate
          </button>

          <button
            className={
              activeTab === "rules"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => setActiveTab("rules")}
          >
            <span>⚙</span>
            Governance
          </button>

          <div className="sidebar-bottom">
            <div className="contract-label">
              INTELLIGENT CONTRACT
            </div>

            <a
              href={`${EXPLORER}/address/${CONTRACT}`}
              target="_blank"
              rel="noreferrer"
              className="contract-link"
            >
              {CONTRACT.slice(0, 8)}...
              {CONTRACT.slice(-6)}
              <span>↗</span>
            </a>

            <div className="powered">
              Powered by GenLayer
            </div>
          </div>
        </aside>

        <section className="content">
          {status && (
            <div className="status-bar">
              <span className="status-icon">●</span>
              <span>{status}</span>
              <button
                onClick={() => setStatus("")}
              >
                ×
              </button>
            </div>
          )}

          {activeTab === "dashboard" && (
            <>
              <section className="hero">
                <div>
                  <div className="eyebrow">
                    AUTONOMOUS GOVERNANCE PROTOCOL
                  </div>

                  <h1>
                    Governance decisions,
                    <br />
                    <span>powered by intelligence.</span>
                  </h1>

                  <p>
                    AgentDAO uses GenLayer Intelligent
                    Contracts to evaluate proposals,
                    coordinate validators, and produce
                    transparent on-chain governance
                    decisions.
                  </p>

                  <div className="hero-actions">
                    <button
                      className="primary-button"
                      onClick={() =>
                        setActiveTab("create")
                      }
                    >
                      Create Proposal
                      <span>→</span>
                    </button>

                    <a
                      className="outline-button"
                      href={`${EXPLORER}/address/${CONTRACT}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Contract ↗
                    </a>
                  </div>
                </div>

                <div className="hero-visual">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />

                  <div className="core">
                    <div className="core-logo">
                      AD
                    </div>
                    <div className="core-title">
                      GENLAYER
                    </div>
                    <div className="core-sub">
                      CONSENSUS
                    </div>
                  </div>

                  <div className="node node-one">
                    V1
                  </div>

                  <div className="node node-two">
                    V2
                  </div>

                  <div className="node node-three">
                    V3
                  </div>

                  <div className="node node-four">
                    V4
                  </div>

                  <div className="node node-five">
                    V5
                  </div>
                </div>
              </section>

              <section className="stats">
                <div className="stat-card">
                  <div className="stat-label">
                    PROPOSALS
                  </div>
                  <div className="stat-value">
                    {proposalCount ?? "—"}
                  </div>
                  <div className="stat-note">
                    On-chain proposals
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">
                    VALIDATORS
                  </div>
                  <div className="stat-value">
                    5
                  </div>
                  <div className="stat-note">
                    Initial consensus set
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">
                    NETWORK
                  </div>
                  <div className="stat-value">
                    61999
                  </div>
                  <div className="stat-note">
                    GenLayer StudioNet
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">
                    CONTRACT
                  </div>
                  <div className="stat-value small">
                    ACTIVE
                  </div>
                  <div className="stat-note">
                    Intelligent Contract
                  </div>
                </div>
              </section>

              <section className="section-heading">
                <div>
                  <div className="eyebrow">
                    LIVE GOVERNANCE
                  </div>
                  <h2>
                    Test the decision engine
                  </h2>
                </div>

                <button
                  className="text-button"
                  onClick={() =>
                    setActiveTab("evaluate")
                  }
                >
                  Evaluate proposal →
                </button>
              </section>

              <section className="demo-grid">
                <button
                  className="proposal-card rejected-card"
                  onClick={() => openProposal(0)}
                >
                  <div className="card-top">
                    <span className="proposal-number">
                      #00
                    </span>

                    <span className="badge rejected">
                      REJECTED
                    </span>
                  </div>

                  <h3>
                    AgentDAO Community Dashboard
                  </h3>

                  <p>
                    Proposal for a public governance
                    transparency dashboard.
                  </p>

                  <div className="score-row">
                    <span>AI Governance Score</span>
                    <strong>32/100</strong>
                  </div>

                  <div className="score-bar">
                    <div
                      style={{ width: "32%" }}
                    />
                  </div>

                  <div className="card-footer">
                    GenLayer evaluated
                    <span>→</span>
                  </div>
                </button>

                <button
                  className="proposal-card rejected-card"
                  onClick={() => openProposal(1)}
                >
                  <div className="card-top">
                    <span className="proposal-number">
                      #01
                    </span>

                    <span className="badge rejected">
                      REJECTED
                    </span>
                  </div>

                  <h3>
                    Community Security Audit
                  </h3>

                  <p>
                    Funding request for a smart-contract
                    security audit.
                  </p>

                  <div className="score-row">
                    <span>AI Governance Score</span>
                    <strong>48/100</strong>
                  </div>

                  <div className="score-bar">
                    <div
                      style={{ width: "48%" }}
                    />
                  </div>

                  <div className="card-footer">
                    GenLayer evaluated
                    <span>→</span>
                  </div>
                </button>

                <button
                  className="proposal-card approved-card"
                  onClick={() => openProposal(2)}
                >
                  <div className="card-top">
                    <span className="proposal-number">
                      #02
                    </span>

                    <span className="badge approved">
                      APPROVED
                    </span>
                  </div>

                  <h3>
                    AgentDAO Security Audit
                  </h3>

                  <p>
                    CertiShield audit with defined scope,
                    budget, timeline, and deliverable.
                  </p>

                  <div className="score-row">
                    <span>AI Governance Score</span>
                    <strong>86/100</strong>
                  </div>

                  <div className="score-bar">
                    <div
                      style={{ width: "86%" }}
                    />
                  </div>

                  <div className="card-footer">
                    Consensus finalized
                    <span>→</span>
                  </div>
                </button>
              </section>
            </>
          )}

          {activeTab === "create" && (
            <section className="page-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    DAO GOVERNANCE
                  </div>
                  <h2>
                    Submit a proposal
                  </h2>
                  <p>
                    Proposals are evaluated by GenLayer
                    validators according to the DAO's
                    governance rules.
                  </p>
                </div>
              </div>

              <div className="form-card">
                <div className="form-grid">
                  <div className="field full">
                    <label>
                      PROPOSAL TITLE
                    </label>

                    <input
                      value={title}
                      onChange={(e) =>
                        setTitle(e.target.value)
                      }
                      placeholder="e.g. Fund ecosystem security audit"
                    />
                  </div>

                  <div className="field full">
                    <label>
                      DESCRIPTION
                    </label>

                    <textarea
                      value={description}
                      onChange={(e) =>
                        setDescription(e.target.value)
                      }
                      placeholder="Explain the proposal, its value, budget justification, timeline, scope, and expected outcome."
                    />
                  </div>

                  <div className="field">
                    <label>
                      REQUESTED AMOUNT
                    </label>

                    <div className="input-unit">
                      <input
                        type="number"
                        min="0"
                        value={requestedAmount}
                        onChange={(e) =>
                          setRequestedAmount(
                            e.target.value
                          )
                        }
                        placeholder="0"
                      />
                      <span>GEN</span>
                    </div>
                  </div>

                  <div className="field">
                    <label>
                      EVIDENCE URL
                    </label>

                    <input
                      value={proposalUrl}
                      onChange={(e) =>
                        setProposalUrl(e.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="form-info">
                  <span>◆</span>
                  <div>
                    <strong>
                      Make your proposal specific.
                    </strong>
                    <p>
                      GenLayer evaluates value,
                      feasibility, evidence, budget
                      justification, and alignment with
                      governance rules.
                    </p>
                  </div>
                </div>

                <button
                  className="primary-button large"
                  onClick={createProposal}
                  disabled={loading}
                >
                  {loading
                    ? "Submitting..."
                    : "Submit Proposal →"}
                </button>
              </div>
            </section>
          )}

          {activeTab === "evaluate" && (
            <section className="page-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    GENLAYER CONSENSUS ENGINE
                  </div>

                  <h2>
                    Evaluate a proposal
                  </h2>

                  <p>
                    Validators independently evaluate the
                    proposal and produce a consensus-backed
                    governance decision.
                  </p>
                </div>
              </div>

              <div className="evaluate-layout">
                <div className="form-card">
                  <label>
                    PROPOSAL ID
                  </label>

                  <div className="evaluate-input">
                    <input
                      type="number"
                      min="0"
                      value={proposalId}
                      onChange={(e) =>
                        setProposalId(e.target.value)
                      }
                      placeholder="0"
                    />

                    <button
                      className="outline-button"
                      onClick={loadProposal}
                      disabled={loading}
                    >
                      Load
                    </button>
                  </div>

                  <button
                    className="primary-button large"
                    onClick={evaluateProposal}
                    disabled={loading}
                  >
                    {loading
                      ? "Running consensus..."
                      : "Run GenLayer Evaluation →"}
                  </button>

                  <div className="validator-flow">
                    <div className="flow-item">
                      <div className="flow-icon">
                        01
                      </div>
                      <div>
                        <strong>
                          Proposal submitted
                        </strong>
                        <span>
                          Read from the Intelligent Contract
                        </span>
                      </div>
                    </div>

                    <div className="flow-line" />

                    <div className="flow-item">
                      <div className="flow-icon">
                        02
                      </div>
                      <div>
                        <strong>
                          Validators evaluate
                        </strong>
                        <span>
                          Independent AI reasoning
                        </span>
                      </div>
                    </div>

                    <div className="flow-line" />

                    <div className="flow-item">
                      <div className="flow-icon">
                        03
                      </div>
                      <div>
                        <strong>
                          Consensus reached
                        </strong>
                        <span>
                          Result committed on-chain
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {proposal ? (
                  <div
                    className={
                      isApproved
                        ? "result-card approved-result"
                        : isRejected
                        ? "result-card rejected-result"
                        : "result-card"
                    }
                  >
                    <div className="result-header">
                      <div>
                        <span className="result-label">
                          GOVERNANCE RESULT
                        </span>
                        <h3>
                          Proposal #{proposalId}
                        </h3>
                      </div>

                      <span
                        className={
                          isApproved
                            ? "badge approved"
                            : "badge rejected"
                        }
                      >
                        {currentVerdict ||
                          currentStatus ||
                          "PENDING"}
                      </span>
                    </div>

                    <div className="score-display">
                      <div
                        className="score-ring"
                        style={{
                          "--score":
                            `${currentScore * 3.6}deg`,
                        }}
                      >
                        <div>
                          <strong>
                            {currentScore}
                          </strong>
                          <span>/100</span>
                        </div>
                      </div>

                      <div>
                        <span className="result-label">
                          AI GOVERNANCE SCORE
                        </span>

                        <h4>
                          {isApproved
                            ? "Proposal approved"
                            : isRejected
                            ? "Proposal rejected"
                            : "Awaiting decision"}
                        </h4>

                        <p>
                          {proposal.title}
                        </p>
                      </div>
                    </div>

                    <div className="result-divider" />

                    <div className="explanation">
                      <span className="result-label">
                        INTELLIGENT CONTRACT EXPLANATION
                      </span>

                      <p>
                        {proposal.explanation ||
                          "No explanation available yet."}
                      </p>
                    </div>

                    <div className="consensus-strip">
                      <div>
                        <span>CONSENSUS</span>
                        <strong>
                          ACCEPTED
                        </strong>
                      </div>

                      <div>
                        <span>VALIDATORS</span>
                        <strong>
                          5
                        </strong>
                      </div>

                      <div>
                        <span>NETWORK</span>
                        <strong>
                          STUDIONET
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-result">
                    <div className="empty-icon">
                      ◈
                    </div>

                    <h3>
                      No proposal loaded
                    </h3>

                    <p>
                      Enter a proposal ID and load it to
                      inspect its governance result.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "rules" && (
            <section className="page-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    GOVERNANCE CONFIGURATION
                  </div>

                  <h2>
                    DAO governance rules
                  </h2>

                  <p>
                    Rules are stored by the AgentDAO
                    Intelligent Contract and used during
                    proposal evaluation.
                  </p>
                </div>
              </div>

              <div className="rules-layout">
                <div className="form-card">
                  <div className="rules-heading">
                    <span className="rules-icon">
                      ◆
                    </span>

                    <div>
                      <h3>
                        Active rules
                      </h3>

                      <p>
                        Current governance policy
                      </p>
                    </div>
                  </div>

                  <div className="active-rules">
                    {governanceRules ||
                      "No governance rules loaded."}
                  </div>

                  <button
                    className="outline-button"
                    onClick={loadGovernanceRules}
                    disabled={loading}
                  >
                    Refresh Rules
                  </button>
                </div>

                <div className="form-card">
                  <div className="rules-heading">
                    <span className="rules-icon">
                      ⚙
                    </span>

                    <div>
                      <h3>
                        Update policy
                      </h3>

                      <p>
                        Write new governance criteria
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={newRules}
                    onChange={(e) =>
                      setNewRules(e.target.value)
                    }
                    placeholder="Define the criteria that proposals must satisfy..."
                  />

                  <button
                    className="primary-button large"
                    onClick={updateGovernanceRules}
                    disabled={loading}
                  >
                    Update Governance Rules →
                  </button>
                </div>
              </div>
            </section>
          )}

          <footer className="footer">
            <div>
              <strong>AgentDAO</strong>
              <span>
                Autonomous governance powered by GenLayer
              </span>
            </div>

            <a
              href={`${EXPLORER}/address/${CONTRACT}`}
              target="_blank"
              rel="noreferrer"
            >
              Intelligent Contract ↗
            </a>
          </footer>
        </section>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #05070d;
          color: #f8fafc;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        .app-shell {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 70% 0%,
              rgba(37, 99, 235, 0.16),
              transparent 32%
            ),
            radial-gradient(
              circle at 10% 35%,
              rgba(124, 58, 237, 0.08),
              transparent 30%
            ),
            #05070d;
          position: relative;
          overflow: hidden;
        }

        .background-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.18;
          background-image:
            linear-gradient(
              rgba(148, 163, 184, 0.05) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(148, 163, 184, 0.05) 1px,
              transparent 1px
            );
          background-size: 50px 50px;
          mask-image: linear-gradient(
            to bottom,
            black,
            transparent 85%
          );
        }

        .topbar {
          height: 76px;
          border-bottom: 1px solid #161b27;
          display: flex;
          align-items: center;
          padding: 0 30px;
          gap: 25px;
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(5, 7, 13, 0.88);
          backdrop-filter: blur(18px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 220px;
        }

        .brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: linear-gradient(
            135deg,
            #2563eb,
            #7c3aed
          );
          font-size: 12px;
          font-weight: 900;
          letter-spacing: -1px;
          box-shadow:
            0 0 30px rgba(59, 130, 246, 0.25);
        }

        .brand-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .brand-sub {
          color: #64748b;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-top: 2px;
        }

        .network-pill {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid #202737;
          border-radius: 999px;
          color: #cbd5e1;
          background: #0b0f18;
          font-size: 12px;
        }

        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e;
        }

        .chain-id {
          color: #64748b;
          padding-left: 4px;
        }

        .wallet-button {
          border: 1px solid #273247;
          background: #111827;
          color: #e2e8f0;
          border-radius: 10px;
          padding: 10px 15px;
          font-size: 12px;
          font-weight: 700;
        }

        .wallet-button:hover {
          border-color: #3b82f6;
        }

        .layout {
          display: flex;
          min-height: calc(100vh - 76px);
        }

        .sidebar {
          width: 235px;
          border-right: 1px solid #161b27;
          padding: 28px 15px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          position: relative;
          z-index: 2;
        }

        .nav-item {
          width: 100%;
          border: 0;
          background: transparent;
          color: #64748b;
          padding: 12px 14px;
          border-radius: 9px;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 5px;
          font-size: 13px;
          font-weight: 600;
        }

        .nav-item span {
          width: 20px;
          text-align: center;
          color: #475569;
        }

        .nav-item:hover {
          color: #e2e8f0;
          background: #0c111c;
        }

        .nav-item.active {
          color: #fff;
          background: linear-gradient(
            90deg,
            rgba(37, 99, 235, 0.18),
            rgba(37, 99, 235, 0.04)
          );
          border: 1px solid rgba(59, 130, 246, 0.18);
        }

        .nav-item.active span {
          color: #60a5fa;
        }

        .sidebar-bottom {
          margin-top: auto;
          padding: 16px 12px;
          border-top: 1px solid #161b27;
        }

        .contract-label {
          font-size: 9px;
          letter-spacing: 1.4px;
          color: #475569;
          margin-bottom: 8px;
        }

        .contract-link {
          color: #60a5fa;
          font-size: 11px;
          font-family: monospace;
          display: flex;
          justify-content: space-between;
        }

        .powered {
          color: #334155;
          font-size: 10px;
          margin-top: 18px;
        }

        .content {
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 30px 40px 60px;
          position: relative;
          z-index: 1;
        }

        .status-bar {
          border: 1px solid #1e293b;
          background: #0b101a;
          color: #cbd5e1;
          border-radius: 10px;
          padding: 11px 14px;
          margin-bottom: 24px;
          font-size: 12px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .status-icon {
          color: #60a5fa;
          font-size: 8px;
        }

        .status-bar button {
          margin-left: auto;
          background: transparent;
          border: 0;
          color: #64748b;
          font-size: 17px;
        }

        .hero {
          min-height: 430px;
          border: 1px solid #1a2230;
          border-radius: 20px;
          background:
            radial-gradient(
              circle at 75% 50%,
              rgba(37, 99, 235, 0.12),
              transparent 35%
            ),
            linear-gradient(
              135deg,
              #0b101a,
              #070a11
            );
          padding: 55px;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          overflow: hidden;
          position: relative;
        }

        .eyebrow {
          color: #60a5fa;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: 800;
          margin-bottom: 13px;
        }

        .hero h1 {
          font-size: clamp(38px, 4vw, 62px);
          line-height: 0.98;
          letter-spacing: -3px;
          margin: 0;
          max-width: 720px;
        }

        .hero h1 span {
          color: #64748b;
        }

        .hero p {
          color: #7c8ba1;
          max-width: 580px;
          line-height: 1.7;
          font-size: 14px;
          margin: 24px 0;
        }

        .hero-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .primary-button {
          border: 1px solid #3b82f6;
          background: linear-gradient(
            135deg,
            #2563eb,
            #1d4ed8
          );
          color: #fff;
          border-radius: 9px;
          padding: 12px 17px;
          font-size: 12px;
          font-weight: 800;
          box-shadow: 0 8px 30px rgba(37, 99, 235, 0.15);
        }

        .primary-button span {
          margin-left: 15px;
        }

        .primary-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 35px rgba(37, 99, 235, 0.25);
        }

        .primary-button.large {
          width: 100%;
          padding: 14px;
          margin-top: 20px;
        }

        .outline-button {
          border: 1px solid #293548;
          background: #0b1019;
          color: #cbd5e1;
          border-radius: 9px;
          padding: 12px 17px;
          font-size: 12px;
          font-weight: 700;
        }

        .outline-button:hover {
          border-color: #3b82f6;
          color: #fff;
        }

        .hero-visual {
          min-height: 320px;
          position: relative;
          display: grid;
          place-items: center;
        }

        .core {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          border: 1px solid #334155;
          background: radial-gradient(
            circle,
            #172554,
            #080b13 70%
          );
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 3;
          box-shadow:
            0 0 70px rgba(37, 99, 235, 0.18),
            inset 0 0 40px rgba(37, 99, 235, 0.08);
        }

        .core-logo {
          font-size: 28px;
          font-weight: 900;
          color: #60a5fa;
        }

        .core-title {
          font-size: 8px;
          letter-spacing: 2px;
          margin-top: 6px;
          color: #94a3b8;
        }

        .core-sub {
          font-size: 7px;
          letter-spacing: 1.5px;
          color: #475569;
          margin-top: 3px;
        }

        .orbit {
          position: absolute;
          border: 1px solid rgba(96, 165, 250, 0.18);
          border-radius: 50%;
        }

        .orbit-one {
          width: 240px;
          height: 240px;
        }

        .orbit-two {
          width: 330px;
          height: 330px;
          border-style: dashed;
          opacity: 0.6;
        }

        .node {
          width: 31px;
          height: 31px;
          border: 1px solid #334155;
          background: #0f172a;
          color: #60a5fa;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 8px;
          font-weight: 800;
          position: absolute;
          z-index: 4;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
        }

        .node-one {
          top: 17%;
          left: 50%;
        }

        .node-two {
          top: 37%;
          right: 8%;
        }

        .node-three {
          bottom: 15%;
          right: 25%;
        }

        .node-four {
          bottom: 15%;
          left: 25%;
        }

        .node-five {
          top: 37%;
          left: 8%;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 12px;
        }

        .stat-card {
          background: #0a0e16;
          border: 1px solid #161e2b;
          border-radius: 12px;
          padding: 19px;
        }

        .stat-label {
          font-size: 9px;
          color: #475569;
          letter-spacing: 1.5px;
          font-weight: 800;
        }

        .stat-value {
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -1px;
          margin-top: 7px;
        }

        .stat-value.small {
          font-size: 18px;
          color: #22c55e;
          padding-top: 5px;
        }

        .stat-note {
          color: #475569;
          font-size: 10px;
          margin-top: 5px;
        }

        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin: 55px 0 18px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -1px;
        }

        .section-heading p {
          color: #64748b;
          max-width: 650px;
          line-height: 1.6;
          font-size: 13px;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #60a5fa;
          font-size: 12px;
          font-weight: 700;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .proposal-card {
          text-align: left;
          color: #fff;
          border: 1px solid #1b2432;
          background: #0a0e16;
          border-radius: 15px;
          padding: 22px;
          transition: 0.2s;
        }

        .proposal-card:hover {
          transform: translateY(-3px);
          border-color: #334155;
          background: #0c111b;
        }

        .approved-card:hover {
          border-color: rgba(34, 197, 94, 0.4);
        }

        .rejected-card:hover {
          border-color: rgba(239, 68, 68, 0.35);
        }

        .card-top,
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .proposal-number {
          color: #475569;
          font-family: monospace;
          font-size: 11px;
        }

        .badge {
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .badge.approved {
          color: #4ade80;
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .badge.rejected {
          color: #f87171;
          background: rgba(239, 68, 68, 0.07);
          border: 1px solid rgba(239, 68, 68, 0.18);
        }

        .proposal-card h3 {
          font-size: 16px;
          margin: 23px 0 8px;
          line-height: 1.3;
        }

        .proposal-card p {
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
          min-height: 54px;
        }

        .score-row {
          display: flex;
          justify-content: space-between;
          margin-top: 18px;
          color: #64748b;
          font-size: 10px;
        }

        .score-row strong {
          color: #cbd5e1;
        }

        .score-bar {
          height: 3px;
          background: #172033;
          border-radius: 10px;
          margin-top: 8px;
          overflow: hidden;
        }

        .score-bar div {
          height: 100%;
          background: #3b82f6;
          border-radius: 10px;
        }

        .approved-card .score-bar div {
          background: #22c55e;
        }

        .rejected-card .score-bar div {
          background: #ef4444;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          color: #475569;
          font-size: 9px;
          margin-top: 20px;
        }

        .page-section {
          max-width: 1150px;
          margin: 0 auto;
        }

        .form-card {
          background: #0a0e16;
          border: 1px solid #1b2432;
          border-radius: 16px;
          padding: 28px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label,
        .form-card > label {
          display: block;
          color: #64748b;
          font-size: 9px;
          letter-spacing: 1.5px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        input,
        textarea {
          width: 100%;
          background: #060910;
          color: #e2e8f0;
          border: 1px solid #202a3a;
          border-radius: 9px;
          padding: 13px;
          outline: none;
          font-size: 12px;
        }

        input:focus,
        textarea:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.06);
        }

        textarea {
          min-height: 150px;
          resize: vertical;
          line-height: 1.6;
        }

        .input-unit {
          position: relative;
        }

        .input-unit input {
          padding-right: 60px;
        }

        .input-unit span {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #60a5fa;
          font-size: 10px;
          font-weight: 800;
        }

        .form-info {
          margin-top: 22px;
          padding: 14px;
          background: #080d16;
          border: 1px solid #172033;
          border-radius: 10px;
          display: flex;
          gap: 12px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
        }

        .form-info > span {
          color: #60a5fa;
        }

        .form-info strong {
          color: #cbd5e1;
        }

        .form-info p {
          margin: 3px 0 0;
        }

        .evaluate-layout {
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 14px;
        }

        .evaluate-input {
          display: flex;
          gap: 8px;
        }

        .evaluate-input input {
          flex: 1;
        }

        .validator-flow {
          margin-top: 28px;
        }

        .flow-item {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .flow-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #101827;
          border: 1px solid #243148;
          color: #60a5fa;
          font-size: 9px;
          font-weight: 800;
        }

        .flow-item strong,
        .flow-item span {
          display: block;
        }

        .flow-item strong {
          color: #cbd5e1;
          font-size: 11px;
        }

        .flow-item span {
          color: #475569;
          font-size: 9px;
          margin-top: 3px;
        }

        .flow-line {
          height: 24px;
          width: 1px;
          background: #253044;
          margin-left: 17px;
        }

        .result-card {
          border: 1px solid #263044;
          background: #0a0e16;
          border-radius: 16px;
          padding: 28px;
        }

        .approved-result {
          border-color: rgba(34, 197, 94, 0.25);
          box-shadow: 0 0 50px rgba(34, 197, 94, 0.04);
        }

        .rejected-result {
          border-color: rgba(239, 68, 68, 0.2);
        }

        .result-label {
          display: block;
          color: #475569;
          font-size: 8px;
          letter-spacing: 1.5px;
          font-weight: 800;
        }

        .result-header h3 {
          margin: 5px 0 0;
          font-size: 20px;
        }

        .score-display {
          display: flex;
          align-items: center;
          gap: 25px;
          margin: 35px 0;
        }

        .score-ring {
          width: 125px;
          height: 125px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background:
            conic-gradient(
              #3b82f6 var(--score),
              #172033 0deg
            );
          position: relative;
          flex-shrink: 0;
        }

        .approved-result .score-ring {
          background:
            conic-gradient(
              #22c55e var(--score),
              #172033 0deg
            );
        }

        .score-ring::before {
          content: "";
          position: absolute;
          inset: 9px;
          background: #0a0e16;
          border-radius: 50%;
        }

        .score-ring div {
          position: relative;
          z-index: 1;
        }

        .score-ring strong {
          font-size: 30px;
          letter-spacing: -2px;
        }

        .score-ring span {
          color: #64748b;
          font-size: 11px;
        }

        .score-display h4 {
          font-size: 17px;
          margin: 8px 0;
        }

        .score-display p {
          color: #64748b;
          font-size: 11px;
          max-width: 330px;
        }

        .result-divider {
          height: 1px;
          background: #182131;
        }

        .explanation {
          padding: 22px 0;
        }

        .explanation p {
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.8;
          margin-bottom: 0;
        }

        .consensus-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid #182131;
          background: #080c13;
          border-radius: 10px;
          overflow: hidden;
        }

        .consensus-strip div {
          padding: 13px;
          border-right: 1px solid #182131;
        }

        .consensus-strip div:last-child {
          border-right: 0;
        }

        .consensus-strip span,
        .consensus-strip strong {
          display: block;
        }

        .consensus-strip span {
          color: #475569;
          font-size: 7px;
          letter-spacing: 1px;
        }

        .consensus-strip strong {
          color: #cbd5e1;
          font-size: 10px;
          margin-top: 5px;
        }

        .empty-result {
          border: 1px dashed #253044;
          border-radius: 16px;
          padding: 70px 30px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .empty-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #60a5fa;
          background: #0d1522;
          margin-bottom: 15px;
        }

        .empty-result h3 {
          margin: 0;
          font-size: 16px;
        }

        .empty-result p {
          color: #475569;
          font-size: 11px;
          max-width: 260px;
          line-height: 1.6;
        }

        .rules-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .rules-heading {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 20px;
        }

        .rules-icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: #60a5fa;
          background: #0e1624;
          border: 1px solid #1f2c42;
        }

        .rules-heading h3 {
          margin: 0;
          font-size: 14px;
        }

        .rules-heading p {
          color: #475569;
          margin: 3px 0 0;
          font-size: 10px;
        }

        .active-rules {
          min-height: 200px;
          padding: 17px;
          border-radius: 10px;
          border: 1px solid #1c2636;
          background: #060910;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.8;
          white-space: pre-wrap;
          margin-bottom: 15px;
        }

        .footer {
          margin-top: 70px;
          border-top: 1px solid #161b27;
          padding-top: 22px;
          display: flex;
          justify-content: space-between;
          color: #475569;
          font-size: 10px;
        }

        .footer strong {
          color: #94a3b8;
          margin-right: 10px;
        }

        .footer a {
          color: #60a5fa;
        }

        @media (max-width: 1050px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .hero-visual {
            display: none;
          }

          .evaluate-layout,
          .rules-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 850px) {
          .sidebar {
            width: 70px;
            padding: 20px 8px;
          }

          .nav-item {
            justify-content: center;
            font-size: 0;
          }

          .nav-item span {
            font-size: 16px;
          }

          .sidebar-bottom {
            display: none;
          }

          .content {
            padding: 20px;
          }

          .stats,
          .demo-grid {
            grid-template-columns: 1fr 1fr;
          }

          .brand-sub,
          .network-pill {
            display: none;
          }
        }

        @media (max-width: 600px) {
          .topbar {
            padding: 0 15px;
          }

          .brand {
            min-width: auto;
          }

          .wallet-button {
            margin-left: auto;
          }

          .hero {
            padding: 30px;
          }

          .hero h1 {
            font-size: 39px;
          }

          .stats,
          .demo-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
          }

          .consensus-strip {
            grid-template-columns: 1fr;
          }

          .consensus-strip div {
            border-right: 0;
            border-bottom: 1px solid #182131;
          }

          .consensus-strip div:last-child {
            border-bottom: 0;
          }

          .footer {
            flex-direction: column;
            gap: 15px;
          }
        }
      `}</style>
    </main>
  );
}