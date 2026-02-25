from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # headless=False to see what's happening
    context = browser.new_context()

    # Capture console logs
    page = context.new_page()
    page.on("console", lambda msg: print(f"CONSOLE: {msg.type}: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    print("Navigating to login page...")
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')

    # Take screenshot of login page
    page.screenshot(path='/tmp/login_page.png', full_page=True)
    print("Screenshot saved to /tmp/login_page.png")

    # Wait for form to be visible
    print("Waiting for email input...")
    page.wait_for_selector('input#email', timeout=5000)

    # Fill in the form
    print("Filling email...")
    page.fill('input#email', 'email@gmail.com')

    print("Filling password...")
    page.fill('input#password', 'password123')

    # Click submit and wait for response
    print("Clicking submit...")

    # Listen for network response
    response = None
    def handle_response(resp):
        global response
        if '/api/auth/callback/credentials' in resp.url or 'callback' in resp.url:
            response = resp
            print(f"Response from {resp.url}: {resp.status}")

    page.on("response", handle_response)

    # Submit form
    page.click('button[type="submit"]')

    # Wait a bit for any redirects
    time.sleep(3)

    # Check current URL
    current_url = page.url
    print(f"Current URL after submit: {current_url}")

    # Take screenshot after submit
    page.screenshot(path='/tmp/after_submit.png', full_page=True)
    print("Screenshot saved to /tmp/after_submit.png")

    # Check for error messages
    error_msg = page.locator('text=Invalid email or password').count()
    print(f"Error message visible: {error_msg > 0}")

    browser.close()
    print("Test complete!")
