# OWNER: voice-id. python enroll.py --user-id 4 -> records 4 sentences -> profiles/4.npy (averaged embedding).
# Names/ids come from hub.get_people().
import argparse

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--user-id', type=int, required=True)
    p.add_argument('--mock', action='store_true')
    args = p.parse_args()
    print('STUB: enroll', args.user_id)
