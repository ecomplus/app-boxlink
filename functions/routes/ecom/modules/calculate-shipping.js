const axios = require('axios')

exports.post = ({ appSdk }, req, res) => {
  /**
   * Treat `params` and (optionally) `application` from request body to properly mount the `response`.
   * JSON Schema reference for Calculate Shipping module objects:
   * `params`: https://apx-mods.e-com.plus/api/v1/calculate_shipping/schema.json?store_id=100
   * `response`: https://apx-mods.e-com.plus/api/v1/calculate_shipping/response_schema.json?store_id=100
   *
   * Examples in published apps:
   * https://github.com/ecomplus/app-mandabem/blob/master/functions/routes/ecom/modules/calculate-shipping.js
   * https://github.com/ecomplus/app-datafrete/blob/master/functions/routes/ecom/modules/calculate-shipping.js
   * https://github.com/ecomplus/app-jadlog/blob/master/functions/routes/ecom/modules/calculate-shipping.js
   */

  const { params, application } = req.body
  const { storeId } = req
  let response = {
    "shipping_services": []
  }
  // merge all app options configured by merchant
  const appData = Object.assign({}, application.data, application.hidden_data)

  if (appData.free_shipping_from_value >= 0) {
    response.free_shipping_from_value = appData.free_shipping_from_value
  }
  if (!params.to) {
    // just a free shipping preview with no shipping address received
    // respond only with free shipping option
    res.send(response)
    return
  }

  const token = appData.token
  if (!token) {
    // must have configured kangu doc number and token
    return res.status(409).send({
      error: 'CALCULATE_AUTH_ERR',
      message: 'Token or document unset on app hidden data (merchant must configure the app)'
    })
  }


  /* DO THE STUFF HERE TO FILL RESPONSE OBJECT WITH SHIPPING SERVICES */


  if (params.items) {
    const body = {
      ...params
    }
    console.log('Body', JSON.stringify(body))
    return axios.post(
      `https://boxtray.boxlink.com.br/e-com/${token}`,
      body,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: (params.is_checkout_confirmation ? 8000 : 5000)
      }
    )

      .then(({ data, status }) => {
        console.log('Status:', status)
        console.log('Resultado:', data)
        let result
        if (typeof data === 'string') {
          try {
            result = JSON.parse(data)
          } catch (e) {
            console.log('> Boxlink invalid JSON response')
            return res.status(409).send({
              error: 'CALCULATE_INVALID_RES',
              message: data
            })
          }
        } else {
          result = data
        }
        console.log('Resultado:', JSON.stringify(result))
        if (result && Number(status) === 200 && Array.isArray(result)) {
          // success response
          response = result
          res.send(response)
        } else {
          // console.log(data)
          const err = new Error('Invalid Boxlink calculate response')
          err.response = { data, status }
          throw err
        }
      })
  } else {
    res.status(400).send({
      error: 'CALCULATE_EMPTY_CART',
      message: 'Cannot calculate shipping without cart items'
    })
  }

  res.send(response)
}
