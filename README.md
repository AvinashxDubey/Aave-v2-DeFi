# Aave-v2-DeFi Project Setup

Get started in a few steps:

## 1. Clone the repository
```sh
git clone <repo-url>
cd Aave-v2-DeFi
```

## 2. Install dependencies
```sh
npm install
```

## 3. Compile contracts
```sh
npx hardhat compile
```

## 4. Run tests
```sh
npx hardhat test
```

---

**Requirements:**
- Node.js (v16+ recommended)
- npm
- Hardhat (auto-installed via npm)

**Main folders:**
- contracts/: Solidity sources
- test/: Test files
- hardhat.config.ts: Project config


---

## How to set up a Hardhat project like this from scratch

1. Create a new folder and initialize npm:
	```sh
	mkdir my-defi-project && cd my-defi-project
	npm init -y
	```

2. Install Hardhat and dependencies:
	```sh
	npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
	```

3. Initialize Hardhat (choose 'Create an empty hardhat.config.js'):
	```sh
	npx hardhat init
	```

4. Write your contracts in `contracts/` and tests in `test/`.

5. Compile and test as above.