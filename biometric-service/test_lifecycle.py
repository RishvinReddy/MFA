import asyncio
import time
import aiohttp
import uuid

async def send_frame(session, i):
    req_id = f"FACE-FRAME-{i:04d}"
    print(f"[{time.time():.3f}] Frontend sending {req_id}")
    
    # Send a small dummy image instead of full 1280x720 to save bandwidth for test, 
    # but the server still does detection.
    # Actually, we should send a valid jpeg.
    import cv2, numpy as np
    img = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    
    data = aiohttp.FormData()
    data.add_field('file', buffer.tobytes(), filename='frame.jpg', content_type='image/jpeg')
    
    headers = {
        'x-biometric-api-key': 'dev_api_key_override_me',
        'x-request-id': req_id
    }
    
    t0 = time.time()
    try:
        async with session.post("http://127.0.0.1:5000/analyze-frame", data=data, headers=headers, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            status = resp.status
            json_resp = await resp.json()
            t1 = time.time()
            print(f"[{t1:.3f}] Frontend received {req_id} (duration: {(t1-t0)*1000:.0f}ms, status: {status}, face_count: {json_resp.get('face_count')}, msg: {json_resp.get('message')})")
    except asyncio.TimeoutError:
        t1 = time.time()
        print(f"[{t1:.3f}] Frontend TIMEOUT {req_id} (duration: {(t1-t0)*1000:.0f}ms)")
    except Exception as e:
        print(f"Frontend ERROR {req_id}: {e}")

async def main():
    async with aiohttp.ClientSession() as session:
        # Simulate 10 frames sent rapidly (e.g. 125ms apart)
        tasks = []
        for i in range(1, 11):
            tasks.append(asyncio.create_task(send_frame(session, i)))
            await asyncio.sleep(0.125) # 125ms interval
            
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
