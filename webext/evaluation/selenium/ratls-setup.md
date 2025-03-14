# Firefox Profile

- The evaluation test site uses a self-signed mini CA.
- Firefox has to trust it.
- The way to do it:
  - create a Firefox profile, that trusts the mini CA
  - load this profile with selenium

There are 3 ways to create such a profile:
1.
    - In Firefox (without Selenium) with the profile created and loaded under `about:profiles`
    - Navigate to `about:preferences -> Certificates` and add the mini CA
    - Copy the profile directory to the `./profiles` directory
2.
    - In Firefox (without Selenium) with the profile created and loaded under `about:profiles`
    - Navigate to the website in question, trust it manually
    - Copy the profile directory to the `./profiles` directory
3.
    - Like mentioned in https://support.mozilla.org/en-US/kb/automatically-trust-third-party-certificates
    - Add the mini CA to the systems trust base
    - **UNTESTED**