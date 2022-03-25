const hre = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log(`deployer.addresss = ${deployer.address}`)

  const PrimarySaleOrchestrator = await hre.ethers.getContractFactory('PrimarySaleOrchestrator')
  console.log('deploying...')
  const primarySaleOrchestrator = await PrimarySaleOrchestrator.deploy()
  console.log('deployed?')

  console.log(`pso= ${primarySaleOrchestrator.address}`)

  await primarySaleOrchestrator.deployed()
  console.log('deployed')

  console.log('PrimarySaleOrchestrator deployed to:', primarySaleOrchestrator.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
