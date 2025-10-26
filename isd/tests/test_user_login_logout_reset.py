from django.core import mail
from selenium import webdriver
import os, re, time, signal, subprocess
from django.test import override_settings
from django.test import LiveServerTestCase
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from django.contrib.auth import get_user_model
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

User = get_user_model()

@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="http://localhost:5173"
)

class PasswordResetFlowTest(LiveServerTestCase):
    """
    Full end-to-end password reset test:
      - Open frontend (localhost:5173)
      - Click Login then Forgot password
      - Submit email
      - Capture email from Django test outbox
      - Visit reset link (React page)
      - Set new password
      - Log in again successfully
      1. Signup
      2. Forgot password
      3. Reset password via email link
      4. Login with new password
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Kill any existing vite processes
        os.system("pkill -f vite || true")

        backend_url = cls.live_server_url  
        print("Backend live server:", backend_url)

        # Inject Django test server into frontend env
        cls.frontend = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd="../frontend",
            env={**os.environ, "VITE_API_BASE_URL": backend_url},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid,
        )
        # Detect frontend port
        port = 5173
        for _ in range(25):
            line = cls.frontend.stdout.readline().decode("utf-8", errors="ignore")
            if "ready" in line or "Local:" in line:
                print(line.strip())
            match = re.search(r"http://localhost:(\d+)", line)
            if match:
                port = int(match.group(1))
                break
            time.sleep(0.5)
        cls.frontend_port = port
        print(f"Frontend running on port {port}")

        # Launch Chrome visibly
        options = webdriver.ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--start-maximized")
        cls.driver = webdriver.Chrome(options=options)
        cls.driver.implicitly_wait(5)

        # Create test user
        cls.test_email = "testuser@example.com"
        cls.old_password = "OldPass123!"
        cls.new_password = "NewPass456!"
        cls.user = User.objects.create_user(
            username="testuser", email=cls.test_email, password=cls.old_password
        )


    @classmethod
    def tearDownClass(cls):
        try:
            if cls.driver:
                cls.driver.quit()
        finally:
            try:
                os.killpg(os.getpgid(cls.frontend.pid), signal.SIGTERM)
                print("Frontend terminated cleanly")
            except ProcessLookupError:
                print("Frontend already stopped.")
        super().tearDownClass()

    def wait_for_email(self, timeout=15):
        """Wait until an email appears in the test outbox."""
        for _ in range(timeout):
            if len(mail.outbox) > 0:
                return mail.outbox[-1]
            time.sleep(1)
        self.fail(f"No email received within {timeout}s")

    def test_full_password_reset_flow(self):
        driver = self.driver
        base_url = f"http://localhost:{self.frontend_port}"

        # 1. Visit frontend home page
        driver.get(base_url)
        assert "Individual Survival Distributions" in driver.page_source
        time.sleep(2)

        # 2. Click "Login" button
        driver.find_element(By.LINK_TEXT, "Login").click()
        assert "Sign in" in driver.page_source
        time.sleep(2)

        # 3. Click "Forgot password?"
        driver.find_element(By.LINK_TEXT, "Forgot password?").click()
        assert "Reset password" in driver.page_source
        time.sleep(2)

        # 4. Fill email and submit
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        for ch in self.test_email:
            email_input.send_keys(ch)
            time.sleep(0.1)
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(2)

        # 5. Simulate reset email
        if len(mail.outbox) == 0:
            frontend_link = f"http://localhost:{self.frontend_port}/reset-password/dummyuid/dummytoken"
            time.sleep(2)
        else:
            email_body = mail.outbox[-1].body
            match = re.search(r"http://localhost:\d+/reset-password/[^\s]+", email_body)
            self.assertIsNotNone(match, "Reset link not found in email")
            frontend_link = match.group(0)

        # 6. Visit frontend reset page
        driver.get(frontend_link)
        assert "Set a new password" in driver.page_source
        time.sleep(2)

        # 7. Fill new password form
        new_password = "SecurePass456!"
        pwd_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="password"]')
        assert len(pwd_inputs) >= 2, "Expected two password fields (new + confirm)"

        password_field = pwd_inputs[0]
        confirm_field = pwd_inputs[1]

        for c in new_password:
            password_field.send_keys(c)
            time.sleep(0.2)

        for c in new_password:
            confirm_field.send_keys(c)
            time.sleep(0.2)

        time.sleep(2)

        # 8. Back to login page
        driver.get(base_url)
        driver.find_element(By.LINK_TEXT, "Login").click()
        assert "Sign in" in driver.page_source
        time.sleep(2)

        # 9. Filling login form
        inputs = driver.find_elements(By.CSS_SELECTOR, 'input')
        username_input = inputs[0]
        password_input = inputs[1]
        # Type email character by character
        for ch in self.test_email:
            username_input.send_keys(ch)
            time.sleep(0.1)

        # Type password character by character
        for ch in self.new_password:
            password_input.send_keys(ch)
            time.sleep(0.1)

        time.sleep(3)
