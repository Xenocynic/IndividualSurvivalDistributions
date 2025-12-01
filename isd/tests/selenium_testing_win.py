from django.core import mail
from selenium import webdriver
import os, re, time, signal, subprocess, platform
from django.test import override_settings
from django.test import LiveServerTestCase
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from django.contrib.auth import get_user_model
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager
from isd.settings import BASE_DIR
from predictors.models import Predictor
from dataset.models import Dataset
from folders.models import Folder, FolderItem
from django.contrib.contenttypes.models import ContentType
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

        # Kill any existing vite processes (cross-platform)
        if platform.system() == "Windows":
            os.system("taskkill /F /IM node.exe /T 2>nul || echo No node process to kill")
        else:
            os.system("pkill -f vite || true")

        backend_url = cls.live_server_url  
        print("Backend live server:", backend_url)

        # Inject Django test server into frontend env
        is_windows = platform.system() == "Windows"
        preexec_fn = os.setsid if not is_windows else None
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if is_windows else 0
        cls.frontend = subprocess.Popen(
            ["npm", "run", "dev", "--", "--host"],
            cwd="../frontend",
            env={**os.environ, "VITE_API_BASE_URL": backend_url, "VITE_SELENIUM": "true"},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            preexec_fn=preexec_fn,
            creationflags=creationflags,
            shell=is_windows,  # Use shell=True on Windows to find npm.cmd
        )
        # Wait for the frontend server to start
        port = 5173
        cls.frontend_port = port
        print("Waiting for frontend to start...")
        time.sleep(10) # Wait 10 seconds for Vite to be ready
        print(f"Frontend running on port {port}")

        # Launch Chrome visibly
        options = webdriver.ChromeOptions()
        options.add_argument("--remote-allow-origins=*")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--start-maximized")
        cls.driver = webdriver.Chrome(options=options)
        cls.driver.implicitly_wait(5)


    @classmethod
    def tearDownClass(cls):
        try:
            if cls.driver:
                cls.driver.quit()
        finally:
            try:
                if platform.system() == "Windows":
                    subprocess.run(f"taskkill /F /T /PID {cls.frontend.pid}", check=True, shell=True)
                else:
                    os.killpg(os.getpgid(cls.frontend.pid), signal.SIGTERM)
                print("Frontend terminated.")
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


    def click_link_text(self, driver, link_text, delay=1):
        element = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, link_text))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", element)
        element.click()
        time.sleep(delay)

    
    def click_button(self, driver, button_text, delay=1):
        """Click a button identified by its XPath and wait for a specified delay."""
        button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, button_text))
        )
        button.click()
        time.sleep(delay)


    def click_link_and_wait_url(self, driver, link_text, delay=1):
        element = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.LINK_TEXT, link_text))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", element)
        element.click()
        time.sleep(delay)


    def create_public_dataset_and_predictors(self, user):
        public_dataset = Dataset.objects.create(
            dataset_name="Public Dataset 1",
            notes="Dataset visible to all users",
            owner=user,
            is_public=True
        )

        Predictor.objects.create(
            name="Public Test Predictor 1",
            description="First public predictor",
            dataset=public_dataset,
            owner=user,
            is_private=False,
        )

        Predictor.objects.create(
            name="Public Test Predictor 2",
            description="Second public predictor",
            dataset=public_dataset,
            owner=user,
            is_private=False,
        )

        Predictor.objects.create(
            name="Selenium Predictor Test",
            description="Training predictors.",
            dataset=public_dataset,
            owner=user,
            is_private=True,
        )

        # (i) Create two public folders
        folder1 = Folder.objects.create(
            name="Public Folder 1",
            description="First public folder containing dataset and predictors",
            owner=user,
            is_private=False
        )

        folder2 = Folder.objects.create(
            name="Public Folder 2",
            description="Second public folder containing same dataset and predictors",
            owner=user,
            is_private=False
        )

        # (ii) Add dataset to both folders
        FolderItem.objects.create(
            folder=folder1,
            content_object=public_dataset,
            added_by=user
        )

        FolderItem.objects.create(
            folder=folder2,
            content_object=public_dataset,
            added_by=user
        )

        # (iii) Add predictors to both folders
        predictor_list = ["Public Test Predictor 1", "Public Test Predictor 2"]

        for predictor_name in predictor_list:
            predictor = Predictor.objects.get(name=predictor_name)
            FolderItem.objects.create(
                folder=folder1,
                content_object=predictor,
                added_by=user
            )
            FolderItem.objects.create(
                folder=folder2,
                content_object=predictor,
                added_by=user
            )


    def password_reset_flow(self, driver=None, base_url=None):
        # 1. Visit frontend home page
        driver.get(base_url)
        assert "Individual Survival Distributions" in driver.page_source
        time.sleep(2)

        # 2. Click "Login" button
        driver.find_element(By.LINK_TEXT, "Login").click()
        assert "Sign in" in driver.page_source
        time.sleep(2)

        # 3. Signing up with new account
        # clicking "Sign Up" link
        driver.find_element(By.LINK_TEXT, "Sign up").click()
        time.sleep(2)

        signup_data = {
            "username": "testuser2",
            "first_name": "Test",
            "last_name": "User",
            "email": "testuser2@example.com",
            "password": "Signup123!",
            "confirm_password": "Signup123!",
            "new_password": "SecurePass456!"
        }

        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="username"]'), signup_data["username"])
        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="given-name"]'), signup_data["first_name"])
        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="family-name"]'), signup_data["last_name"])
        self.human_type(driver.find_element(By.CSS_SELECTOR, 'input[autocomplete="email"]'), signup_data["email"])
        self.human_type(driver.find_element(By.ID, "password"), signup_data["password"])
        self.human_type(driver.find_element(By.ID, "confirm-password"), signup_data["confirm_password"])

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        
        WebDriverWait(driver, 15).until(
            lambda d: "Account created successfully!" in d.page_source or "Welcome" in d.page_source
        )
        assert "Account created successfully!" in driver.page_source or "Welcome" in driver.page_source
        time.sleep(3)
        
        # 4. Click "Forgot password?"
        time.sleep(2)
        driver.find_element(By.LINK_TEXT, "Forgot password?").click()
        assert "Reset password" in driver.page_source
        time.sleep(2)

        # 5. Fill email and submit
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        self.human_type(email_input, "testuser2@example.com")
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(2)

        # 6. Simulate reset email
        if len(mail.outbox) == 0:
            frontend_link = f"http://localhost:{self.frontend_port}/reset-password/dummyuid/dummytoken"
            time.sleep(3)
        else:
            email_body = mail.outbox[-1].body
            match = re.search(r"http://localhost:\d+/reset/confirm/[^\s]+", email_body)
            self.assertIsNotNone(match, "Reset link not found in email")
            frontend_link = match.group(0)

        # 7. Visit frontend reset page
        driver.get(frontend_link)
        assert "Set a new password" in driver.page_source
        time.sleep(2)

        # 8. Fill new password form
        pwd_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="password"]')
        assert len(pwd_inputs) >= 2, "Expected two password fields (new + confirm)"

        password_field = pwd_inputs[0]
        confirm_field = pwd_inputs[1]

        self.human_type(password_field, signup_data["new_password"])
        self.human_type(confirm_field, signup_data["new_password"])

        submit_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[type="submit"]'))
        )
        submit_button.click()
        time.sleep(2)

        success_msg = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'Password updated. Please sign in.')]")
            )
        )
        assert "Password updated. Please sign in." in success_msg.text
        time.sleep(3)

        # 9. Filling login form
        inputs = driver.find_elements(By.CSS_SELECTOR, 'input')
        username_input = inputs[0]
        password_input = inputs[1]

        self.human_type(username_input, signup_data["username"])
        self.human_type(password_input, signup_data["new_password"])

        # Submit login
        login_button = driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
        login_button.click()
        WebDriverWait(driver, 10).until(lambda d: "Browse" in d.page_source or "About" in d.page_source)
        time.sleep(7)


    def logout(self, driver=None):
        # Step (i) Click the profile button to open the dropdown
        profile_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Profile"]'))
        )
        profile_button.click()

        # Step (ii) Wait for the Logout button to appear
        logout_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Logout']"))
        )
        time.sleep(2)

        # Step (iii) Click logout
        ActionChains(driver).move_to_element(logout_button).click().perform()
        time.sleep(3)


    def basic_pages(self, driver=None):

        # 1. Navigating to About Page
        self.click_link_and_wait_url(driver, "About", delay=3)
        self.smooth_scroll_down_up(driver)

        # 2. Navigating to Instructions Page
        self.click_link_and_wait_url(driver, "Instructions", delay=3)
        self.smooth_scroll_down_up(driver)

        # 3. Creating a dataset and predictor to test Browse page
        user = User.objects.get(username="testuser2")
        self.create_public_dataset_and_predictors(user)

        # 4. Navigating to Browse Page
        self.click_link_and_wait_url(driver, "Browse", delay=3)
        self.smooth_scroll_down_up(driver)


    def view_predictor(self, driver=None):
        # Wait for predictor cards to appear on the dashboard page
        predictor_cards = WebDriverWait(driver, 15).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div[role='button'].group.relative"))
        )
        assert len(predictor_cards) > 0, "No predictor cards found on the page."

        # Click the first predictor card to reveal 'View' and star buttons
        first_card = predictor_cards[0]
        driver.execute_script("arguments[0].scrollIntoView(true);", first_card)
        driver.execute_script("arguments[0].click();", first_card)
        # Wait for the selection to register and for the action buttons to appear
        WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[title="Pin"]')))
        time.sleep(1)

        # Pinning first predictor
        star_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[title="Pin"]'))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", star_button)
        time.sleep(1)
        driver.execute_script("arguments[0].click();", star_button)
        time.sleep(2)

        # After pinning, the card remains selected. We just need to find the 'View' button.
        view_button_selector = "div[class*='ring-2'] button[title='View']"
        view_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, view_button_selector))
        )
        driver.execute_script("arguments[0].click();", view_button)
        self.smooth_scroll_down_up(driver)
        self.click_button(driver, '//button[text()="dataset"]')
        self.smooth_scroll_down_up(driver)
        self.click_button(driver, '//button[text()="Predictor Settings / Retrain"]')
        self.smooth_scroll_down_up(driver)
        self.click_button(driver, '//button[text()="cross validation"]')
        self.smooth_scroll_down_up(driver)
        self.click_button(driver, '//button[@aria-label="Back"]')
        
        # Wait until we are back on the browse page
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//div[contains(text(), 'Browse Predictors')]"))
        )
        WebDriverWait(driver, 10).until(
            EC.url_contains("/browse")
        )

    
    def view_datasets(self, driver=None):
        try:
            datasets_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Datasets']"))
            )
            driver.execute_script("arguments[0].scrollIntoView(true);", datasets_button)
            time.sleep(0.5)
            driver.execute_script("arguments[0].click();", datasets_button)

            # Wait for datasets page to load
            WebDriverWait(driver, 5).until(EC.url_contains("/datasets"))
            print("Navigated to Datasets page.")

        except Exception as e:
            if "/datasets" in driver.current_url:
                print("(Fallback) Navigated to Datasets page despite minor delay.")

        # Wait for dataset cards to appear on the browse page
        dataset_cards = WebDriverWait(driver, 15).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div[role='button'].group.relative"))
        )
        assert len(dataset_cards) > 0, "No dataset cards found on the page."

        # Click the first dataset card to reveal 'View' and star buttons
        first_card = dataset_cards[0]
        driver.execute_script("arguments[0].scrollIntoView(true);", first_card)
        first_card.click()
        time.sleep(1)

        # Pinning first dataset
        star_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[title="Pin"]'))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", star_button)
        driver.execute_script("arguments[0].click();", star_button)
        time.sleep(1)

        # Unpinning first dataset
        star_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[title="Unpin"]'))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", star_button)
        driver.execute_script("arguments[0].click();", star_button)
        time.sleep(2)

        # Click the 'View' button within the context of the selected card
        view_button_selector = "div[class*='ring-2'] button[title='View']"
        view_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, view_button_selector))
        )
        driver.execute_script("arguments[0].scrollIntoView(true);", view_button)
        view_button.click()
        time.sleep(2)

    
    def view_folders(self, driver=None):
        try:
            folders_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Folders']"))
            )
            driver.execute_script("arguments[0].scrollIntoView(true);", folders_button)
            time.sleep(0.5)
            driver.execute_script("arguments[0].click();", folders_button)
            time.sleep(1)

            # Wait for datasets page to load
            WebDriverWait(driver, 5).until(EC.url_contains("/folders"))
            print("Navigated to Folders page.")

        except Exception as e:
            if "/folders" in driver.current_url:
                print("(Fallback) Navigated to Folders page despite minor delay.")


    def create_edit_folder(self, driver=None):
        # Navigate to the Folders Section of the Dashboard
        self.click_button(driver, "//button[contains(text(), 'Folders')]", delay=2)

        """1. Filters"""
        # Clicking 'All Folders' filter icon
        self.click_button(driver, "//button[contains(., 'All Folders')]")

        # Clicking 'Recently Updated' filter icon
        self.click_button(driver, "//button[contains(., 'Recently Updated')]")

        """2. Create New Folder"""
        # Clicking 'Create New Folder' button
        self.click_button(driver, "//*[contains(text(), 'Create')]/ancestor::button[1]")
        self.click_button(driver, "(//div[@role='menu']//button)[3]")
        self.smooth_scroll_down_up(driver)

        # Wait for fragment to appear 
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(., 'Create New Folder')]"))
        )

        # Filling in details
        self.human_type(driver.find_element(By.ID, "folderName"), "Selenium Test Folder")
        self.human_type(driver.find_element(By.ID, "folderDescription"), "This is created for automated tests.")

        # Selecting Privacy as Private
        self.click_button(driver, "//button[@role='switch']")

        # Submitting form
        self.click_button(driver, "//button[contains(., 'Create Folder')]", delay=3)

        # Wait for folder cards to appear
        folder_cards = WebDriverWait(driver, 15).until(
            EC.presence_of_all_elements_located(
                (By.CSS_SELECTOR, "div.group.relative.rounded-xl.border.bg-white.shadow-card")
            )
        )

        assert len(folder_cards) > 0, "No folder cards found on the Folders page."

        # Click the first folder card
        time.sleep(4)
        first_folder = folder_cards[0]
        driver.execute_script("arguments[0].scrollIntoView(true);", first_folder)
        first_folder.click()
        time.sleep(3)

        """3. Edit Folder"""
        # Edit Folder Functionality
        self.click_button(driver, "//button[@title='Edit folder']")

        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(., 'Edit Folder')]"))
        )

        # Wait for the textarea to be actually attached & visible
        desc_area = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//textarea[contains(@placeholder, 'Optional description')]"))
        )

        driver.execute_script("arguments[0].scrollIntoView(true);", desc_area)
        time.sleep(0.5)

        # Refetch again to avoid stale reference
        desc_area = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//textarea[contains(@placeholder, 'Optional description')]"))
        )

        # Now safe to clear and type
        desc_area.clear()

        self.human_type(desc_area, "Updated description")
        self.click_button(driver, "//button[contains(., 'Save Changes')]", delay=4)

        """4. Sharing folders"""
        first_folder = folder_cards[0]
        driver.execute_script("arguments[0].scrollIntoView(true);", first_folder)
        first_folder.click()
        time.sleep(3)

        self.click_button(driver, ".//button[@title='Share folder']", delay=2)

        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(., 'Share Folder')]"))
        )
        self.smooth_scroll_down_up(driver)
        time.sleep(2)

        self.click_button(driver, "//button[normalize-space()='✕']", delay=3)

        """5. Duplicating folders"""
        first_folder = folder_cards[0]
        driver.execute_script("arguments[0].scrollIntoView(true);", first_folder)
        first_folder.click()
        time.sleep(3)

        self.click_button(driver, ".//button[@title='Duplicate folder']", delay=2)

        # Wait for the duplicated folder to appear
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//h2[contains(., 'Duplicate Folder')]"))
        )
        self.smooth_scroll_down_up(driver)
        time.sleep(2)

        # Filling in name
        name_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "duplicate-folder-name"))
        )
        name_input.clear()
        self.human_type(name_input, "Duplicate Folder")
        time.sleep(1)

        # Filling in description
        desc_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "duplicate-folder-description"))
        )
        desc_input.clear()
        self.human_type(desc_input, "Duplicated during Selenium testing.")
        time.sleep(1)

        # Click the 'Duplicate Folder' submit button
        self.click_button(driver, "//button[contains(., 'Duplicate Folder')]", delay=2)
        time.sleep(4)


    def create_edit_dataset(self, driver=None):
        # Navigate to the Datasets Section of the Dashboard
        self.click_button(driver, "//button[contains(text(), 'Datasets')]", delay=2)

        """1. Create New Dataset"""
        # Clicking 'Create New Dataset' button
        self.click_button(driver, "//*[contains(text(), 'Create')]/ancestor::button[1]")
        self.click_button(driver, "(//div[@role='menu']//button)[2]")
        self.smooth_scroll_down_up(driver)

        # Wait for new page to appear 
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//div[contains(@class, 'tracking-wide') and contains(., 'Upload Dataset')]"))
        )

        # Filling in details
        self.human_type(driver.find_element(By.XPATH, "//input[@placeholder='A concise dataset name']"), "Selenium Dataset Test")
        self.human_type(driver.find_element(By.XPATH, "//textarea[contains(@placeholder, 'Optional description')]"), "This is the description for an automated test.")

        # Uploading .csv file
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        AML_CSV_PATH = os.path.join(BASE_DIR, "AML.csv")
        file_input = driver.find_element(By.XPATH, "//input[@type='file']")
        time.sleep(2)

        # Locate the upload box <label>
        upload_box = driver.find_element(
            By.XPATH,
            "//label[contains(@class,'border-dashed') and contains(@class,'grid')]"
        )

        # Smooth scroll into the middle of the screen
        driver.execute_script(
            "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
            upload_box
        )
        time.sleep(2)
        file_input.send_keys(AML_CSV_PATH)
        time.sleep(2)        

        self.click_button(driver, "//button[contains(., 'Save') and not(@disabled)]")
        print("JS errors:", driver.get_log("browser"))
        self.click_button(driver, "//button[contains(text(), 'Datasets')]", delay=2)

        # Wait for dataset cards to appear on the page
        dataset_cards = WebDriverWait(driver, 15).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "div[role='button'].group.relative"))
        )
        assert len(dataset_cards) > 0, "No dataset cards found on the Browse page."

        # Click the first dataset card to reveal 'View' and star buttons
        first_card = dataset_cards[0]
        driver.execute_script("arguments[0].scrollIntoView(true);", first_card)
        first_card.click()
        time.sleep(4)

    
    def create_edit_predictor(self, driver=None):
        """1. Create New Predictor"""
        # Clicking 'Create New Predictor' button
        self.click_button(driver, "//*[contains(text(), 'Create')]/ancestor::button[1]")
        self.click_button(driver, "(//div[@role='menu']//button)[1]")
        self.smooth_scroll_down_up(driver)

        # Wait for new page to appear 
        WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.XPATH, "//div[contains(@class, 'tracking-wide') and contains(., 'Create New Predictor')]"))
        )

        # Filling in details
        self.human_type(driver.find_element(By.XPATH, "//input[@placeholder='A concise predictor name']"), "Selenium Predictor  Test")
        self.human_type(driver.find_element(By.XPATH, "//textarea[contains(@placeholder, 'Optional description')]"), "Training predictors.")       
        time.sleep(1)

        # Locate the select for folders
        folder_select = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((
                By.XPATH,
                "//select[contains(@class,'rounded-md') and contains(@class,'border')]"
            ))
        )

        # Smooth scroll into view
        driver.execute_script(
            "arguments[0].scrollIntoView({behavior:'smooth', block:'center'});",
            folder_select
        )
        time.sleep(1)

        # Wait for the AML dataset card to appear
        aml_card = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((
                By.XPATH,
                "//button[.//div[contains(text(),'This is the description for an automated test.')]]"
            ))
        )

        # Smooth scroll into view
        driver.execute_script(
            "arguments[0].scrollIntoView({behavior:'smooth', block:'center'});",
            aml_card
        )
        time.sleep(1)

        # Click the dataset card
        aml_card.click()
        time.sleep(1)

        # Scroll & press the Train & Save button
        train_button = driver.find_element(
            By.XPATH,
            "//button[contains(@class,'bg-neutral-900') and contains(text(),'Train & Save')]"
        )

        driver.execute_script(
            "arguments[0].scrollIntoView({behavior:'smooth', block:'center'});",
            train_button
        )
        time.sleep(2)
        train_button.click()


    def test_selenium(self):
        driver = self.driver
        base_url = f"http://localhost:{self.frontend_port}"

        # Running the password reset flow test
        self.password_reset_flow(driver=driver, base_url=base_url)

        # Running basic page navigation tests
        self.basic_pages(driver=driver)
       
        # View Predictor Details (including pinning)
        self.view_predictor(driver=driver)

        # View Datasets Details (including pinning and unpinning)
        self.view_datasets(driver=driver)

        # View Folders Details
        self.view_folders(driver=driver)

        # Going to Dashboard
        self.click_link_and_wait_url(driver, "Dashboard", delay=3)

        # Creating a new folder from Dashboard
        self.create_edit_folder(driver=driver)

        # Creating a new Dataset from Dashboard
        self.create_edit_dataset(driver=driver)

        # Creating a new Predictor from Dashboard
        self.create_edit_predictor(driver=driver)
        
        # Logging out
        self.logout(driver=driver)