import json
import uuid
from pathlib import Path
from urllib.request import Request, build_opener, HTTPCookieProcessor
from urllib.error import HTTPError
from http.cookiejar import CookieJar

ROOT=Path(__file__).resolve().parent
fixture=json.loads((ROOT/'fixture.json').read_text())
base=fixture['base_url']
if base != 'http://127.0.0.1:8765':
    raise RuntimeError('This reproduction script targets only the isolated local fixture.')
jar=CookieJar()
opener=build_opener(HTTPCookieProcessor(jar))
records=[]
def call(method,path,data=None,record=True):
    headers={'Accept':'application/json','Accept-Language':'en'}
    token=next((c.value for c in jar if c.name=='csrftoken'),'')
    if token: headers['X-CSRFToken']=token
    if data is not None: headers['Content-Type']='application/json'
    request=Request(base+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers=headers)
    try: response=opener.open(request,timeout=20)
    except HTTPError as error: response=error
    raw=response.read().decode()
    body=json.loads(raw) if raw else None
    if record: records.append({'method':method,'path':path,'request':data,'status':response.code,'response':body})
    return response.code,body

call('GET','/api/auth/csrf/',record=False)
status,_=call('POST','/api/auth/login/',{'username':'qa_manager_a','password':'QaPortfolioOnly2026!'},record=False)
assert status==200,'Local QA login failed.'
prefix='QA RECHECK '+uuid.uuid4().hex[:6]
def new_deal(suffix):
    status,prop=call('POST','/api/properties/',{'title':prefix+suffix,'kind':'apartment','deal_type':'sale','district':'esil','address':'Synthetic QA address','area':'65.0','price':50000000})
    assert status==201,prop
    status,deal=call('POST','/api/deals/',{'title':prefix+suffix,'client':fixture['clients']['a'],'property':prop['id'],'amount':50000000,'deal_type':'sale'})
    assert status==201,deal
    return deal['id']

deal=new_deal(' amount')
status,body=call('POST',f'/api/deals/{deal}/move/',{'stage':'contract'})
assert status==200,body
status,body=call('PATCH',f'/api/deals/{deal}/',{'amount':0})
print('BUG-001 reproduced:',status==200 and body.get('stage')=='contract' and body.get('amount')==0)
deal=new_deal(' property')
status,body=call('POST',f'/api/deals/{deal}/move/',{'stage':'viewing'})
assert status==200,body
status,body=call('PATCH',f'/api/deals/{deal}/',{'property':None})
print('BUG-002 reproduced:',status==200 and body.get('stage')=='viewing' and body.get('property') is None)
(ROOT/'recheck-results.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('Requests and responses saved to recheck-results.json.')
