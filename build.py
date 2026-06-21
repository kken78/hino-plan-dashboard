import json
kpi=json.load(open('data/kpi.json'))
plan=json.load(open('data/plan.json'))
survey=json.load(open('data/survey.json'))
data_js = "const KPI=%s;\nconst PLAN=%s;\nconst SURVEY=%s;" % (
  json.dumps(kpi,ensure_ascii=False),
  json.dumps(plan,ensure_ascii=False),
  json.dumps(survey,ensure_ascii=False))
open('assets/data_bundle.js','w').write(data_js)
print("bundle written", len(data_js),"chars -> assets/data_bundle.js")
