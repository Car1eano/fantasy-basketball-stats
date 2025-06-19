import csv
from yahoo_oauth import OAuth2    

def save_match_result(output_path, league_key, week):
    print(f'running week {week} result')

    oauth = OAuth2(None, None, from_file='/Users/carleano/Desktop/includeOauthFantasy/oauth.json')
    if not oauth.token_is_valid():
        oauth.refresh_access_token()

    url = f"https://fantasysports.yahooapis.com/fantasy/v2/league/{league_key}/scoreboard;week={week}?format=json"

    response = oauth.session.get(url)
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
    else:
        data = response.json()
        # print(json.dumps(data, indent=2))  # 可以保留看印出內容

        
    # write data into csv
    with open(output_path, 'w', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)

        stat_title = [
            'player', 'player_id', 
            'FGM/A*', 'FG%', 
            'FTM/A*', 'FT%', 
            '3PTM', '3PTA*', '3PT%', 
            'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO', 'PF', 'DD'
        ]

        stat_names = [
            'field_goal_att_made', 'field_goal_per', 'free_throw_att_made',
            'free_throw_goal_per', 'three_point_made', 'three_point_att',
            'three_point_per', 'points', 'rebounds', 'assists',
            'steals', 'blocks', 'turn_overs', 'personal_fouls', 'double_double'
        ]

        writer.writerow(stat_title)

        for match_index in range(6):
            match_index_str = str(match_index)
            players_dict = data['fantasy_content']['league'][1]['scoreboard']['0']['matchups'][match_index_str]['matchup']['0']['teams']
            
            for player_match_up in range(2):
                pmu_str = str(player_match_up)
                single_player = players_dict[pmu_str]['team']

                player = single_player[0][2]['name']
                player_id = single_player[0][0]['team_key']

                single_player_stats = single_player[1]['team_stats']['stats']

                stat_values = {
                    name: single_player_stats[i]['stat']['value']
                    for i, name in enumerate(stat_names)
                }

                writer.writerow([player, player_id] + [stat_values[name] for name in stat_names])

if __name__ == '__main__':

    league_key = "454.l.130312"
    single_week = 11
    do_single_week_result = 0

    if do_single_week_result == 0:
        for week in range(1,20):
            output_csv_path = f'/Users/carleano/Desktop/includeOauthFantasy/fantasy-stats-app/public/data/week{week}.csv'
            save_match_result(output_csv_path, league_key, week)
    else:
        output_csv_path = f'/Users/carleano/Desktop/includeOauthFantasy/fantasy-stats-app/public/data/week{single_week}.csv'
        save_match_result(output_csv_path, league_key, single_week)