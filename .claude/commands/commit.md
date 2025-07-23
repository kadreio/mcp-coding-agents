Bundle all outstanding into logical commits, and then commit them with good messages. Ensure we're not committing any senstive data. Run all tests in server and client before committing. If they fail, ask for feedback. Note these tests include
frontend:
`npm test`
`npm test:e2e`
backend
`make check`
`make test-all`