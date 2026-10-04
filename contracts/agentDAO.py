# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class AgentDAO(gl.Contract):

    # =========================================================
    # DAO GOVERNANCE RULES
    # =========================================================

    governance_rules: str

    # =========================================================
    # PROPOSALS
    # =========================================================

    creators: DynArray[Address]

    titles: DynArray[str]
    descriptions: DynArray[str]
    requested_amounts: DynArray[u256]
    proposal_urls: DynArray[str]

    # =========================================================
    # LIFECYCLE
    # =========================================================

    statuses: DynArray[str]

    # =========================================================
    # AI GOVERNANCE DECISION
    # =========================================================

    verdicts: DynArray[str]
    scores: DynArray[u32]
    explanations: DynArray[str]

    # =========================================================
    # TIMESTAMPS
    # =========================================================

    created_at: DynArray[str]
    evaluated_at: DynArray[str]

    def __init__(self):

        self.governance_rules = """
You are evaluating proposals for a decentralized community.

A proposal should be APPROVED when:
1. It provides a clear benefit to the community or ecosystem.
2. The requested amount is reasonable for the described work.
3. The proposal provides enough information to evaluate the idea.
4. There is no obvious conflict of interest or malicious intent.
5. The proposal is consistent with the DAO's stated governance rules.

A proposal should be REJECTED when:
1. It clearly violates the governance rules.
2. The request is unreasonable or unsupported.
3. The proposal is malicious, fraudulent, or clearly harmful.
4. There is insufficient information to justify approval.

The evaluator must only use the information provided.
Do not invent facts.
"""

    # =========================================================
    # INTERNAL HELPERS
    # =========================================================

    def _zero_address(self) -> Address:

        return Address(
            "0x0000000000000000000000000000000000000000"
        )

    def _require_valid_id(
        self,
        proposal_id: u32
    ) -> None:

        if proposal_id >= u32(
            len(self.titles)
        ):
            raise gl.vm.UserError(
                "Proposal does not exist"
            )

    # =========================================================
    # UPDATE GOVERNANCE RULES
    # =========================================================

    @gl.public.write
    def set_governance_rules(
        self,
        rules: str
    ) -> None:

        if not rules.strip():
            raise gl.vm.UserError(
                "Governance rules are required"
            )

        self.governance_rules = rules.strip()

    # =========================================================
    # CREATE PROPOSAL
    # =========================================================

    @gl.public.write
    def create_proposal(
        self,
        title: str,
        description: str,
        requested_amount: u256,
        proposal_url: str
    ) -> u32:

        if not title.strip():
            raise gl.vm.UserError(
                "Proposal title is required"
            )

        if not description.strip():
            raise gl.vm.UserError(
                "Proposal description is required"
            )

        proposal_id = u32(
            len(self.titles)
        )

        self.creators.append(
            gl.message.sender_address
        )

        self.titles.append(
            title.strip()
        )

        self.descriptions.append(
            description.strip()
        )

        self.requested_amounts.append(
            requested_amount
        )

        self.proposal_urls.append(
            proposal_url.strip()
        )

        self.statuses.append(
            "PENDING"
        )

        self.verdicts.append(
            ""
        )

        self.scores.append(
            u32(0)
        )

        self.explanations.append(
            ""
        )

        self.created_at.append(
            ""
        )

        self.evaluated_at.append(
            ""
        )

        return proposal_id

    # =========================================================
    # EVALUATE PROPOSAL
    # =========================================================

    @gl.public.write
    def evaluate_proposal(
        self,
        proposal_id: u32
    ) -> None:

        self._require_valid_id(
            proposal_id
        )

        if (
            self.statuses[
                proposal_id
            ]
            != "PENDING"
        ):
            raise gl.vm.UserError(
                "Proposal has already been evaluated"
            )

        title = self.titles[
            proposal_id
        ]

        description = self.descriptions[
            proposal_id
        ]

        requested_amount = (
            self.requested_amounts[
                proposal_id
            ]
        )

        proposal_url = (
            self.proposal_urls[
                proposal_id
            ]
        )

        rules = self.governance_rules

        # =====================================================
        # FETCH OPTIONAL PROPOSAL SOURCE
        # =====================================================

        def fetch_source():

            if not proposal_url:
                return ""

            if not proposal_url.startswith(
                "https://"
            ):
                raise gl.vm.UserError(
                    "Proposal URL must use HTTPS"
                )

            response = gl.nondet.web.get(
                proposal_url
            )

            if response is None:
                raise gl.vm.UserError(
                    "Proposal source unavailable"
                )

            body = response.body

            if body is None:
                raise gl.vm.UserError(
                    "Proposal source is empty"
                )

            if len(body) > 200000:
                raise gl.vm.UserError(
                    "Proposal source is too large"
                )

            try:
                return body.decode(
                    "utf-8"
                )
            except Exception:
                raise gl.vm.UserError(
                    "Proposal source is not valid UTF-8"
                )

        # =====================================================
        # AI EVALUATION
        # =====================================================

        def evaluate():

            source_content = fetch_source()

            prompt = f"""
You are the governance evaluator for a decentralized DAO.

DAO GOVERNANCE RULES:
{rules}

PROPOSAL TITLE:
{title}

PROPOSAL DESCRIPTION:
{description}

REQUESTED AMOUNT:
{requested_amount} GEN

PROPOSAL SOURCE URL:
{proposal_url}

SOURCE CONTENT:
{source_content}

Evaluate whether this proposal should be approved.

You must evaluate ONLY the stated DAO governance rules
and the information available in the proposal.

Do not invent facts.

If the proposal lacks enough information to reasonably
justify approval, reject it.

Return ONLY valid JSON:

{{
    "verdict": "APPROVED" or "REJECTED",
    "score": integer from 0 to 100,
    "explanation": "short factual explanation"
}}

Scoring:

90-100:
Strong proposal that clearly satisfies the governance rules.

70-89:
Generally good proposal with minor weaknesses.

50-69:
Mixed proposal with significant uncertainty.

0-49:
Proposal clearly fails important governance requirements.
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json"
            )

            if not isinstance(
                result,
                dict
            ):
                raise gl.vm.UserError(
                    "Malformed governance response"
                )

            verdict = str(
                result.get(
                    "verdict",
                    ""
                )
            ).upper().strip()

            explanation = str(
                result.get(
                    "explanation",
                    ""
                )
            ).strip()

            try:
                score = int(
                    result.get(
                        "score",
                        0
                    )
                )
            except Exception:
                raise gl.vm.UserError(
                    "Invalid governance score"
                )

            if verdict not in (
                "APPROVED",
                "REJECTED"
            ):
                raise gl.vm.UserError(
                    "Invalid governance verdict"
                )

            if score < 0 or score > 100:
                raise gl.vm.UserError(
                    "Invalid governance score"
                )

            if not explanation:
                raise gl.vm.UserError(
                    "Governance explanation is required"
                )

            return {
                "verdict": verdict,
                "score": score,
                "explanation": explanation
            }

        # =====================================================
        # LEADER
        # =====================================================

        def leader_fn():

            return evaluate()

        # =====================================================
        # VALIDATOR
        # =====================================================

        def validator_fn(
            leader_result
        ) -> bool:

            if not isinstance(
                leader_result,
                gl.vm.Return
            ):
                return False

            leader_data = (
                leader_result.calldata
            )

            if not isinstance(
                leader_data,
                dict
            ):
                return False

            leader_verdict = str(
                leader_data.get(
                    "verdict",
                    ""
                )
            ).upper().strip()

            if leader_verdict not in (
                "APPROVED",
                "REJECTED"
            ):
                return False

            try:
                validator_data = evaluate()
            except Exception:
                return False

            if not isinstance(
                validator_data,
                dict
            ):
                return False

            validator_verdict = str(
                validator_data.get(
                    "verdict",
                    ""
                )
            ).upper().strip()

            if validator_verdict not in (
                "APPROVED",
                "REJECTED"
            ):
                return False

            # The critical governance decision must match.
            if (
                leader_verdict
                != validator_verdict
            ):
                return False

            # Scores may differ slightly because the
            # evaluators are independent.
            leader_score = int(
                leader_data.get(
                    "score",
                    0
                )
            )

            validator_score = int(
                validator_data.get(
                    "score",
                    0
                )
            )

            if abs(
                leader_score
                - validator_score
            ) > 20:
                return False

            return True

        # =====================================================
        # GENLAYER CONSENSUS
        # =====================================================

        result = gl.vm.run_nondet_unsafe(
            leader_fn,
            validator_fn
        )

        if not isinstance(
            result,
            dict
        ):
            raise gl.vm.UserError(
                "Malformed consensus result"
            )

        verdict = str(
            result.get(
                "verdict",
                ""
            )
        ).upper().strip()

        explanation = str(
            result.get(
                "explanation",
                ""
            )
        ).strip()

        score = int(
            result.get(
                "score",
                0
            )
        )

        if verdict not in (
            "APPROVED",
            "REJECTED"
        ):
            raise gl.vm.UserError(
                "Consensus returned invalid verdict"
            )

        if score < 0 or score > 100:
            raise gl.vm.UserError(
                "Consensus returned invalid score"
            )

        if not explanation:
            raise gl.vm.UserError(
                "Consensus returned no explanation"
            )

        # =====================================================
        # STORE RESULT
        # =====================================================

        self.verdicts[
            proposal_id
        ] = verdict

        self.scores[
            proposal_id
        ] = u32(score)

        self.explanations[
            proposal_id
        ] = explanation

        self.evaluated_at[
            proposal_id
        ] = ""

        if verdict == "APPROVED":

            self.statuses[
                proposal_id
            ] = "APPROVED"

        else:

            self.statuses[
                proposal_id
            ] = "REJECTED"

    # =========================================================
    # VIEWS
    # =========================================================

    @gl.public.view
    def get_proposal(
        self,
        proposal_id: u32
    ):

        self._require_valid_id(
            proposal_id
        )

        return {
            "id": proposal_id,

            "creator": str(
                self.creators[
                    proposal_id
                ]
            ),

            "title": self.titles[
                proposal_id
            ],

            "description": self.descriptions[
                proposal_id
            ],

            "requested_amount": (
                self.requested_amounts[
                    proposal_id
                ]
            ),

            "proposal_url": (
                self.proposal_urls[
                    proposal_id
                ]
            ),

            "status": self.statuses[
                proposal_id
            ],

            "verdict": self.verdicts[
                proposal_id
            ],

            "score": self.scores[
                proposal_id
            ],

            "explanation": self.explanations[
                proposal_id
            ],

            "created_at": self.created_at[
                proposal_id
            ],

            "evaluated_at": self.evaluated_at[
                proposal_id
            ]
        }

    @gl.public.view
    def get_proposal_count(
        self
    ) -> u32:

        return u32(
            len(self.titles)
        )

    @gl.public.view
    def get_status(
        self,
        proposal_id: u32
    ) -> str:

        self._require_valid_id(
            proposal_id
        )

        return self.statuses[
            proposal_id
        ]

    @gl.public.view
    def get_verdict(
        self,
        proposal_id: u32
    ) -> str:

        self._require_valid_id(
            proposal_id
        )

        return self.verdicts[
            proposal_id
        ]

    @gl.public.view
    def get_score(
        self,
        proposal_id: u32
    ) -> u32:

        self._require_valid_id(
            proposal_id
        )

        return self.scores[
            proposal_id
        ]

    @gl.public.view
    def get_explanation(
        self,
        proposal_id: u32
    ) -> str:

        self._require_valid_id(
            proposal_id
        )

        return self.explanations[
            proposal_id
        ]

    @gl.public.view
    def get_governance_rules(
        self
    ) -> str:

        return self.governance_rules