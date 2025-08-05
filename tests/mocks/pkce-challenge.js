// Mock for pkce-challenge to avoid dynamic import issues in Jest
module.exports = {
  generateChallenge: async () => ({
    codeVerifier: 'mock-code-verifier',
    codeChallenge: 'mock-code-challenge'
  })
};