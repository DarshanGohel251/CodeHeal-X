# ⚡ CodeHeal X — Autonomous Backend Repair Engineer

**CodeHeal X** is an API-first autonomous AI agent that detects backend crashes, analyzes error logs, and automatically generates surgical code patches to fix them. Built for the UPAI-Hackdays.

![CodeHeal X UI Preview](public/preview.png) *(Note: You can add a screenshot of your UI to the public folder and link it here)*

## 🚀 The Problem & Solution
When a backend crashes in production, developers waste hours reading stack traces, tracing variables, and figuring out what broke. 

**CodeHeal X** acts as an automated pipeline for backend repair. Instead of a generic "chat with your code" wrapper, it provides a closed-loop workflow:
1. **Input:** Provide the broken code and the error log (e.g., `NullPointerException`).
2. **Analysis:** The AI agent securely parses the context and identifies the root cause.
3. **Execution:** The AI generates a precise, valid JSON patch without unnecessary refactoring.
4. **Verification:** The system displays a live terminal simulation and a "Before/After" diff of the repaired code.

## 🛠️ Tech Stack
* **Frontend:** Vanilla HTML, CSS, JavaScript (Zero-dependency, Vercel/Linear inspired UI)
* **Backend:** Node.js, Express.js
* **AI Engine:** Google Gemini API (`@google/genai` SDK)
* **Architecture:** "Bring Your Own Key" (BYOK) - API keys are held only in memory for the session lifecycle and never stored.

## ⚙️ How to Run Locally

You need [Node.js](https://nodejs.org/) installed on your machine.

**1. Clone the repository**
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/codeheal-x.git
cd codeheal-x
\`\`\`

**2. Install dependencies**
\`\`\`bash
npm install
\`\`\`

**3. Start the server**
\`\`\`bash
npm start
\`\`\`
*(Or run `node server.js` directly)*

**4. Access the application**
Open your browser and navigate to:
\`\`\`text
http://localhost:3000
\`\`\`

## 🧪 How to Test (The Demo Bug)
To see the autonomous repair loop in action:
1. Obtain a free [Google Gemini API Key](https://aistudio.google.com/app/apikey).
2. Enter the key in the CodeHeal X configuration panel.
3. Use the following sample data to test the agent:

**Broken Source Code:**
\`\`\`java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    @Autowired private UserService userService;

    @GetMapping("/{id}/profile")
    public ResponseEntity<UserProfile> getUserProfile(@PathVariable Long id) {
        User user = userService.findById(id);
        UserProfile profile = user.getProfile(); // BUG: Fails if user is null
        return ResponseEntity.ok(profile);
    }
}
\`\`\`

**Error Log:**
\`\`\`text
java.lang.NullPointerException: Cannot invoke "com.exceptionzero.demo.model.User.getProfile()" because "user" is null
    at com.exceptionzero.demo.controller.UserController.getUserProfile(UserController.java:23)
\`\`\`
4. Click **Start Autonomous Repair** and watch the AI inject the correct null-check logic.

## 🔮 Future Scope
This MVP focuses on AI root-cause analysis and patch generation. The future CI/CD vision includes:
* **Webhook Integration:** Connect directly to GitHub or Sentry to trigger repairs on production alerts.
* **Sandbox Verification:** Execute the generated patch inside a secure Docker container and run unit tests before proposing the fix.
* **Auto-PR Creation:** Automatically open a Pull Request with the verified fix.

---
*Built with ❤️ for UPAI-Hackdays 2026*
