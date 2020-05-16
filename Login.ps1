$username=$args[0]
$password=$args[1]

Invoke-WebRequest -Uri "http://localhost:3001/login" -Method "POST" -Headers @{
 "Pragma"="no-cache"
   "Cache-Control"="no-cache"
   "Upgrade-Insecure-Requests"="1"
   "Origin"="http://localhost:3001"
   "User-Agent"="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36"
   "Accept"="text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9"
   "Sec-Fetch-Site"="same-origin"
   "Sec-Fetch-Mode"="navigate"
   "Sec-Fetch-User"="?1"
   "Sec-Fetch-Dest"="document"
   "Referer"="http://localhost:3001/login"
   "Accept-Encoding"="gzip, deflate, br"
   "Accept-Language"="en-US,en;q=0.9"
   "Cookie"="_4c_=fVHLjtswDPyVQOckq5clypeiaIGiH1DsMZAlOTbiWIasbJoG%2BfelvEGKPpCTRHJmSA6v5NyFkdSsAgCpKAVDYU0O4TKT%2BkpS78vzRmpCwQfmjfDOc2HBtbYBrhWjVoJzDsia%2FCw6RinOjOZCm9uauOnOvxIXfUAdZrZqKxCdf2G04ZLiP4ylxZQ8%2FlukEG4rBxxarbmW1rWV1VUIlnsftIeq8L993n3%2FWqCUCgZCMdh%2BbIEjSKyf0oDVLuepfnkZorNDF%2BdcC0ophvt4yp8QNaXoTy7v8mUq051Ds5r9AQtNiuc5JMx96VI8hhUwzEa0hbz2o8cihim0IaUF9f9Ge3sMiJv7XNQfxXsKbcbs2A1Nv9nHt2JKSMfSokxWLCk9F1ah46GWtX882Rs9X84AYATeQFZSoGpGK0BJnIhSREwYLldhDzQoKjSvhLyjmfyNXs73B3rRRrT%2BV%2FvDtycc8zfndnsH; connect.sid=s%3AovsIh5OFSyfCDb9fKO_fWx93O-rwTkmp.Cml91RuQg%2BetFP7%2FsPVT1TAp8IqzF9ux7Br20ozPM6Q"
 } -ContentType "multipart/form-data; boundary=----WebKitFormBoundarySQWfsBgfzjz69BFi" -Body ([System.Text.Encoding]::UTF8.GetBytes("------WebKitFormBoundarySQWfsBgfzjz69BFi$([char]13)$([char]10)Content-Disposition: form-data; name=`"id`"$([char]13)$([char]10)$([char]13)$([char]10)$username$([char]13)$([char]10)------WebKitFormBoundarySQWfsBgfzjz69BFi$([char]13)$([char]10)Content-Disposition: form-data; name=`"password`"$([char]13)$([char]10)$([char]13)$([char]10)$password$([char]13)$([char]10)------WebKitFormBoundarySQWfsBgfzjz69BFi--$([char]13)$([char]10)"))
