const hre = require('hardhat')
const { parseUnits, parseEther } = ethers.utils

//const { PSO_ADDRESS } = require('../.env.js')

const {
  STAGING_DATABASE_URL: DATABASE_URL,
  PRIMARY_SALE_SPLIT_NFT_1_TO_4,
  PRIMARY_SALE_SPLIT_NFT_5,
  PRIMARY_SALE_SPLIT_NFT_6,
  PSO_ADDRESS,
} = require('../.env.js')

const { Pool, Client } = require('pg')

const ONE_DAY = 60 * 60 * 24

async function main() {
  const [deployer] = await ethers.getSigners()

  const pso = await hre.ethers.getContractAt('PrimarySaleOrchestrator', PSO_ADDRESS)

  const isDeployed = await pso.deployed()
  if (!isDeployed) {
    console.log('Not deployed!!')
    return
  }

  console.log(`Signing with ${deployer.address}`)

  const nftId = 3
  const paymentAddress = ''

  const client = new Client({
    connectionString: DATABASE_URL,
  })
  client.connect()
  const { rowCount, rows } = await client.query(
    `SELECT 
        *,
        b.id as bidid,
        u."walletAddress" as userWallet,
        a."walletAddress" as artistWallet 
    from 
        "Bids" as b,
        "Users" as u,
        "Nfts" as n,
        "Artists" as a 
    where 
        b."userID"= u.id 
        and "nftID" = ${nftId} 
        and n.id=b."nftID" 
    order by "DateBid" desc`,
  )

  const firstRow = rows[0]
  console.log({ firstRow, rowCount })

  rows.map((row) => {
    console.log(`${row.DateBid}/${row.walletAddress} --> ${row.AmountETH}`)
  })

  const _priceWithoutNetworkFee = firstRow.minimumBidETH - 0.03

  const _priceWithoutNetworkFeeStr = parseUnits(_priceWithoutNetworkFee.toString())

  console.log({ _priceWithoutNetworkFee, _priceWithoutNetworkFeeStr })

  let splitPaymentAddress
  if (firstRow.tokenId == 4) splitPaymentAddress = PRIMARY_SALE_SPLIT_NFT_5
  else if (firstRow.tokenId == 5) splitPaymentAddress = PRIMARY_SALE_SPLIT_NFT_6
  else splitPaymentAddress = PRIMARY_SALE_SPLIT_NFT_1_TO_4

  const startDate = parseInt((await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp)
  const endDate = startDate + ONE_DAY

  const startDateDate = new Date(startDate * 1000)
  const endDateDate = new Date(endDate * 1000)

  const startDateStr = startDateDate.toISOString()
  const endDateStr = endDateDate.toISOString()

  console.log({ startDateStr, endDateStr })

  const saleVoucher = {
    _id: '1',
    _tokenAddress: firstRow.PolygonAddress,
    _tokenId: firstRow.tokenId,
    _holderAddress: firstRow.artistwallet,
    _price: _priceWithoutNetworkFeeStr,
    _bidWinnerAddress: firstRow.userwallet,
    _paymentRecipientAddress: splitPaymentAddress,
    _startDate: startDateStr,
    _deadline: endDateStr,
  }

  console.log({ saleVoucher })

  const updateStatement = await client.query(`update "Bids" set "isWinner" = true where id=${firstRow.bidid}`)
  console.log({ updateStatement })

  const msgHash1 = await pso.doHash(
    saleVoucher._id,
    saleVoucher._tokenAddress,
    saleVoucher._tokenId,
    saleVoucher._holderAddress,
    saleVoucher._price,
    saleVoucher._bidWinnerAddress,
    saleVoucher._paymentRecipientAddress,
    startDate,
    endDate,
  )

  console.log({ msgHash1 })

  let signatureFull = await deployer.signMessage(ethers.utils.arrayify(msgHash1))

  // For Solidity, we need the expanded-format of a signature
  let signature = ethers.utils.splitSignature(signatureFull)
  const psoRecover = await pso.recover(msgHash1, signature.v, signature.r, signature.s)

  console.log({ psoRecover, signer: deployer.address })

  console.log({ signature })

  const insertSQL = `Insert into "SaleVouchers" 
        (id , "paymentRecipientAddress" , "startDate" , deadline , r ,s , v , "createdAt" , "updatedAt" )
    values 
        ( ${saleVoucher._id},
          '${saleVoucher._paymentRecipientAddress}',
          $1,
          $2,
          ['${signature.r}'],
          ['${signature.s}'],
          ['${signature.v}'],
          now(),
          now())`
  console.log({ insertSQL })

  const resultInsert = await client.query(insertSQL, startDateDate, endDateDate)

  console.log({ resultInsert })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
