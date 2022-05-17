require('dotenv').config()

const { parseUnits, parseEther } = ethers.utils
const {
  PRODUCTION_DATABASE_URL: DATABASE_URL,
  PRIMARY_SALE_SPLIT_NFT_1_TO_4,
  PRIMARY_SALE_SPLIT_NFT_5,
  PRIMARY_SALE_SPLIT_NFT_6,
  PSO_ADDRESS,
} = require('../.env.js')

const { Pool, Client } = require('pg')
const ONE_DAY = 60 * 60 * 24
const sign = require('../test/utils/createCheque')

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

async function main() {
  const [deployer] = await ethers.getSigners()

  const pso = await hre.ethers.getContractAt('PrimarySaleOrchestrator', PSO_ADDRESS)

  const isDeployed = await pso.deployed()
  if (!isDeployed) {
    console.log('Not deployed!!')
    return
  }

  /*#################################################*/
  //Modify to change the nft
  const nftId = 3
  /*#################################################*/

  const saleVoucherID = getRandomInt(100000)

  console.log(`PSO_ADDRESS=${PSO_ADDRESS}`)
  console.log(`Signing with ${deployer.address}`)

  const signers = await pso.signersAll()
  console.log({ signers })

  console.log(`signers    = ${signers}`)

  const client = new Client({
    connectionString: DATABASE_URL,
  })
  client.connect()
  const { rowCount, rows } = await client.query(
    `SELECT 
        *,
        u."walletAddress" as "userWallet",
        a."walletAddress" as "artistWallet" 
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

  const startDate = Math.floor(Date.now() / 1000)
  const endDate = startDate + ONE_DAY

  console.log({ now: Date.now(), startDate, endDate })

  let splitPaymentAddress
  if (firstRow.tokenId == 4) splitPaymentAddress = PRIMARY_SALE_SPLIT_NFT_5
  else if (firstRow.tokenId == 5) splitPaymentAddress = PRIMARY_SALE_SPLIT_NFT_6
  else splitPaymentAddress = PRIMARY_SALE_SPLIT_NFT_1_TO_4

  const saleVoucherUnsigned = {
    _id: saleVoucherID,
    _tokenAddress: firstRow.PolygonAddress,
    _tokenId: firstRow.tokenId,
    _holderAddress: firstRow.artistWallet,
    _priceETH: firstRow.minimumBidETH - 0.03,
    _price: parseEther((firstRow.minimumBidETH - 0.03).toString()),
    _bidWinner: firstRow.userWallet,
    _paymentRecipient: splitPaymentAddress,
    _startDate: startDate,
    _deadline: endDate,
  }

  console.log({ saleVoucherUnsigned })

  if (signers.length != 1 || signers[0] !== deployer.address) {
    console.log('Need to update signers!')
  } else {
    console.log('signers OK')
  }

  const hash = await pso.doHash(
    saleVoucherUnsigned._id,
    saleVoucherUnsigned._tokenAddress,
    saleVoucherUnsigned._tokenId,
    saleVoucherUnsigned._holderAddress,
    saleVoucherUnsigned._price,
    saleVoucherUnsigned._bidWinner,
    saleVoucherUnsigned._paymentRecipient,
    saleVoucherUnsigned._startDate,
    saleVoucherUnsigned._deadline,
  )
  console.log({ hash })

  const saleVoucher = await sign(
    deployer,
    saleVoucherUnsigned._tokenAddress,
    saleVoucherUnsigned._tokenId,
    saleVoucherUnsigned._holderAddress,
    saleVoucherUnsigned._price,
    saleVoucherUnsigned._bidWinner,
    saleVoucherUnsigned._paymentRecipient,
    saleVoucherUnsigned._startDate,
    saleVoucherUnsigned._deadline,
    pso,
  )

  console.log({ signature: saleVoucher._signature })

  const bidId = firstRow.id
  const paymentRecipientAddress = saleVoucher._paymentRecipientAddress
  const r = [saleVoucher._signature.r]
  const s = [saleVoucher._signature.s]
  const v = [saleVoucher._signature.v]

  const insertStm = await client.query(
    `insert into "SaleVouchers" 
        (id,"paymentRecipientAddress","startDate", deadline , r , s , v , "createdAt" , "updatedAt" , "bidID") 
    values (
        ${saleVoucher._id},
        '${paymentRecipientAddress}',
        to_timestamp(${saleVoucher._startDate}),
        to_timestamp(${saleVoucher._deadline}),
        ARRAY ['${saleVoucher._signature.r}'],
        ARRAY ['${saleVoucher._signature.s}'],
        ARRAY ['${saleVoucher._signature.v}'],
        now(),
        now(),
        ${bidId}
    )`,
  )

  const updateBids = await client.query(`update "Bids" set "isWinner"=true where id=${firstRow.id}`)

  console.log({ insertStm, updateBids })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
