from django.core import mail
from selenium import webdriver
import os, re, time, signal, subprocess
from django.test import override_settings
from django.test import LiveServerTestCase
from selenium.webdriver.common.by import By
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
class SignupForgotResetLoginTest(LiveServerTestCase):
    """
    End-to-end test:
      1. Signup
      2. Forgot password
      3. Reset password via email link
      4. Login with new password
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Start frontend
        cls.frontend = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd="../frontend",
            env={**os.environ, "VITE_API_BASE_URL": cls.live_server_url},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid,
        )

        # Detect frontend port
        cls.frontend_port = 5173
        for _ in range(25):
            line = cls.frontend.stdout.readline().decode("utf-8", errors="ignore")
            match = re.search(r"http://localhost:(\d+)", line)
            if match:
                cls.frontend_port = int(match.group(1))
                break
            time.sleep(0.5)

        # Setup Selenium Chrome
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--start-maximized")
        cls.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        cls.driver.implicitly_wait(5)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.driver.quit()
        finally:
            try:
                os.killpg(os.getpgid(cls.frontend.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        super().tearDownClass()

    def wait_for_email(self, timeout=15):
        """Wait until an email appears in Django test outbox."""
        start = time.time()
        while time.time() - start < timeout:
            if len(mail.outbox) > 0:
                return mail.outbox[-1]
            time.sleep(1)
        self.fail(f"No email received within {timeout}s")

    @staticmethod
    def human_type(element, text, delay=0.1):
        """Simulate human typing character by character."""
        for char in text:
            element.send_keys(char)
            time.sleep(delay)
        ActionChains(element.parent).move_to_element(element).click().perform()

    def smooth_scroll_down_up(self, driver, delay=1):
        """Smoothly scroll down to bottom and back up."""
        driver.execute_script(
            "window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});"
        )
        time.sleep(delay)  # wait for scroll to finish
        driver.execute_script(
            "window.scrollTo({top: 0, behavior: 'smooth'});"
        )
        time.sleep(delay)

    def test_signup_forgot_reset_login(self):
        driver = self.driver
        base_url = f"http://localhost:{self.frontend_port}"

        # --- NAVIGATE TO SIGNUP ---
        driver.get(base_url)
        time.sleep(2)

        # Click "Login" first
        driver.find_element(By.LINK_TEXT, "Login").click()
        time.sleep(1)

        # Then click "Sign Up" link
        driver.find_element(By.LINK_TEXT, "Sign up").click()
        time.sleep(2)

        # --- SIGNUP FORM ---

        signup_data = {
            "username": "testuser2",
            "first_name": "Test",
            "last_name": "User",
            "email": "testuser2@example.com",
            "password": "SignupPass123!",
            "confirm_password": "SignupPass123!",
            "new_password": "NewPass123!"
        }

        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="username"]'), signup_data["username"])
        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="given-name"]'), signup_data["first_name"])
        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="family-name"]'), signup_data["last_name"])
        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="email"]'), signup_data["email"])
        self.human_type(driver.find_element(By.ID, "password"), signup_data["password"])
        self.human_type(driver.find_element(By.ID, "confirm-password"), signup_data["confirm_password"])

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(2)
        WebDriverWait(driver, 15).until(
            lambda d: "Account created successfully!" in d.page_source or "Welcome" in d.page_source
        )
        assert "Account created successfully!" in driver.page_source or "Welcome" in driver.page_source
        time.sleep(2)

        # --- CLICK LOGIN ---
        login_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Login"))
        )
        login_link.click()
        time.sleep(2) 

        # --- CLICK FORGOT PASSWORD ---
        forgot_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Forgot password?"))
        )
        forgot_link.click()
        time.sleep(1)

        # --- ENTER EMAIL for reset ---
        email_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
        )
        self.human_type(email_input, "testuser2@example.com")
        time.sleep(2)

        # --- SUBMIT the reset request ---
        submit_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[type="submit"]'))
        )
        submit_button.click()
        time.sleep(2)

        # --- GET REAL RESET LINK FROM EMAIL ---
        email = self.wait_for_email()
        match = re.search(r"http://localhost:\d+/reset/confirm/[^\s]+", email.body)
        self.assertIsNotNone(match, "Reset link not found in email")
        reset_link = match.group(0)
        time.sleep(2)

        # --- RESET PASSWORD ---
        driver.get(reset_link)
        time.sleep(2)

        # Type passwords with simulated human delay
        self.human_type(driver.find_element(By.ID, "new-password"), signup_data["new_password"])
        self.human_type(driver.find_element(By.ID, "confirm-password"), signup_data["new_password"])

        # Click submit
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(2)
        
        # --- CLICK LOGIN ---
        # Wait until redirected to login page
        WebDriverWait(driver, 10).until(EC.url_contains("/login"))
        time.sleep(2) 

        # --- LOGIN WITH NEW PASSWORD ---

        # Wait until login page input appears
        username_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "current-username"))
        )
        password_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "current-password"))
        )

        self.human_type(username_input, signup_data["username"])
        self.human_type(password_input, signup_data["new_password"])

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(2)
        # Wait for redirect / dashboard confirmation
        WebDriverWait(driver, 15).until(
            lambda d: "Logout" in d.page_source or "Dashboard" in d.page_source
        )
        assert "Logout" in driver.page_source or "Dashboard" in driver.page_source
        time.sleep(3)

        # --- NAVIGATE TO ABOUT PAGE ---
        about_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "About"))
        )
        about_link.click()
        WebDriverWait(driver, 5).until(EC.url_contains("/about"))
        time.sleep(1)
        self.smooth_scroll_down_up(driver)

        # --- NAVIGATE TO INSTRUCTIONS PAGE ---
        instructions_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Instructions"))
        )
        instructions_link.click()
        WebDriverWait(driver, 5).until(EC.url_contains("/instructions"))
        time.sleep(1)
        self.smooth_scroll_down_up(driver)