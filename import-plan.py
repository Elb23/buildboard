"""Build the complete curriculum from the user's original 193-page plan.

Usage: python scripts/import-plan.py /path/to/Engineering-Learning-Plan.pdf
The committed JSON is sufficient to run the application; Python is only needed
when re-importing a new source PDF.
"""
from pathlib import Path
from pypdf import PdfReader
import json, re, sys

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1])
pages=[p.extract_text() or '' for p in PdfReader(source).pages]
clean=lambda text: re.sub(r'\s+', ' ', text).strip()
months=[
 ('Programming foundations','A tested monitoring-summary CLI and a clear baseline of independent coding ability.'),
 ('Structured code and the first backend','Sitewatch stores sites and checks in PostgreSQL and exposes a tested local API.'),
 ('A deployed service and applications','Ownership checks, scheduled checks, alerts and a public demonstration. Applications begin in Week 10.'),
 ('Reliability and backend readiness','Recovery, query improvement, backup restoration and an independent feature. Complete the Week 16 readiness assessment.'),
 ('Incident investigation and agents','An evidence-based incident assistant with a fixed-workflow baseline, held-out evaluation and bounded read-only tools.'),
 ('Evaluation, releases and commercial next steps','Two documented capstones, measured AI results, practical assessments and a buyer/pilot roadmap.')
]
tasks=[];weeks=[];extras=[]
for page,text in enumerate(pages,1):
 text=re.sub(r'\nOne block at a time\. Stop at the timer\. Keep evidence\..*', '', text,flags=re.S)
 m=re.search(r'Week (\d+) / Session (\d+) \| (\d+) focused hours\n',text)
 if m:
  week,session,hours=map(int,m.groups());body=text[m.end():]
  title,body=re.split(r'\nInput\n',body,maxsplit=1)
  input_text,body=re.split(r'\nProduce\n',body,maxsplit=1)
  deliverable,body=re.split(r'\n(?=1\. [^\n]+ / \d+ min\n)',body,maxsplit=1)
  work,stop=re.split(r'\nStop\n',body,maxsplit=1)
  stop=re.split(r'\nAt the timer:',stop,maxsplit=1)[0]
  pattern=r'(\d+)\. ([^\n]+) / ([^\n]+) / (\d+) min\n(.*?)(?=\n\d+\. [^\n]+ / \d+ min\n|\Z)'
  blocks=[]
  for bm in re.finditer(pattern,work,re.S):
   number,module,kind,minutes,content=bm.groups()
   parts=re.split(r'\nCheck: ',content,maxsplit=1)
   blocks.append({'id':f'b{number}','module':clean(module),'kind':clean(kind),'minutes':int(minutes),'instruction':clean(parts[0]),'check':clean(parts[1]) if len(parts)>1 else ''})
  assert sum(b['minutes'] for b in blocks)==hours*60,(week,session,blocks)
  modules=list(dict.fromkeys(b['module'] for b in blocks))
  dominant=max(modules,key=lambda module:sum(b['minutes'] for b in blocks if b['module']==module))
  cat={'Software':'Software','Backend':'Backend','API':'API','AI':'AI','Python':'Python','SQL':'SQL','DSA':'DSA','Career':'Career'}.get(dominant,'General')
  global_session=(week-1)*6+session
  tasks.append({'id':f'week{week}-session{session}','key':f'W{week:02d}-{session:02d}','week':week,'month':(week-1)//4+1,'session':session,'order':global_session,'title':clean(title),'description':clean(deliverable),'input':clean(input_text),'stop':clean(stop),'blocks':blocks,'modules':modules,'category':cat,'hours':hours,'sourcePage':page})
  continue
 m=re.search(r'Month (\d+) \| 24 core \+ 4 freestyle \+ 2 review hours\nWeek (\d+) / ',text)
 if m:
  month,week=map(int,m.groups());body=text[m.end():]
  title,body=re.split(r'\nDeliver: ',body,maxsplit=1)
  deliverable,rest=re.split(r'\nBefore starting: ',body,maxsplit=1)
  prerequisites=re.split(r'\nModule\n',rest,maxsplit=1)[0]
  goals=re.split(r'Finish when you can demonstrate\n',rest,maxsplit=1)[-1]
  goal_text,reading=re.split(r'\n4 hours free reading / 2 hours review\n',goals,maxsplit=1)
  weeks.append({'week':week,'month':month,'title':clean(title),'deliverable':clean(deliverable),'prerequisites':clean(prerequisites),'finishCriteria':[clean(s) for s in re.split(r'\n\* ',goal_text) if clean(s).strip('* ')],'readingReview':clean(reading),'sourcePage':page,'gate':week in [4,10,12,16,18,20,23,24]})
 elif re.search(r'Week \d+ / Session \d+ input\n',text):
  mm=re.search(r'Week (\d+) / Session (\d+) input\n(.*)',text,re.S)
  extras.append({'week':int(mm[1]),'session':int(mm[2]),'page':page,'title':clean(mm[3].split('\n')[0]),'text':mm[3]})
tasks.sort(key=lambda t:t['order']);weeks.sort(key=lambda w:w['week'])
assert len(tasks)==144 and len(weeks)==24
assert sum(t['hours'] for t in tasks)==576
plan={'version':2,'title':'Backend & Applied AI Engineering','weeks':weeks,'months':[{'month':i+1,'title':title,'outcome':outcome,'startWeek':i*4+1,'endWeek':i*4+4} for i,(title,outcome) in enumerate(months)],'tasks':tasks,'starters':extras,'budget':{'weeks':24,'coreHours':576,'readingHours':96,'reviewHours':48,'totalHours':720},'source':{'name':'Engineering-Learning-Plan.pdf','pages':193,'roadmapPages':84},'bookNote':'An Illustrated Guide to AI Agents — Jay Alammar & Maarten Grootendorst is the additional agent book you selected; use it for tool use and orchestration alongside the source plan.'}
(root/'data/plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print(f'Imported {len(tasks)} sessions, {len(weeks)} weeks, {len(extras)} starter references; {sum(t["hours"] for t in tasks)} core hours.')
