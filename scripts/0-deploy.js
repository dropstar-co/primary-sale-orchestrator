const hre = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log(`deployer.addresss = ${deployer.address}`)

  const PrimarySaleOrchestrator = await hre.ethers.getContractFactory('PrimarySaleOrchestrator')
  const primarySaleOrchestrator = await PrimarySaleOrchestrator.deploy(metadataURI)

  await primarySaleOrchestrator.deployed()

  console.log('PrimarySaleOrchestrator deployed to:', primarySaleOrchestrator.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
