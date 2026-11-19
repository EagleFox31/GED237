FROM ged237-bench-ocr0
# Modeles v5 latin mobile telecharges au build (le run n'a pas de reseau).
ARG REV=1
RUN python -I -c "import sys; sys.path.insert(0,'/app/scripts'); \
import numpy as np; from rapidocr import EngineType, LangDet, LangRec, ModelType, OCRVersion, RapidOCR; \
p={'Det.engine_type':EngineType.ONNXRUNTIME,'Det.lang_type':LangDet.CH,'Det.model_type':ModelType.MOBILE,'Det.ocr_version':OCRVersion.PPOCRV5,'Rec.engine_type':EngineType.ONNXRUNTIME,'Rec.lang_type':LangRec.LATIN,'Rec.model_type':ModelType.MOBILE,'Rec.ocr_version':OCRVersion.PPOCRV5}; \
RapidOCR(params=p)(np.zeros((64,256,3),dtype='uint8')); print('v5 latin ok')"
