import React, { useEffect, useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import './App.css';

// 總共有 19 週，建立一個陣列方便後面使用
const totalWeeks = 19;
const weekOptions = Array.from({ length: totalWeeks }, (_, i) => i + 1);

// 【新增】定義 Fantasy 比較的項目
const fantasyCategories = ['FG%', 'FT%', '3PTM', '3PT%', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO', 'PF', 'DD'];
const lowerIsBetterCategories = new Set(['TO', 'PF']);


function App() {
  // --- State 管理 ---
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [data, setData] = useState([]); // 原始 CSV 資料
  const [headers, setHeaders] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'descending' });
  const nonSortableColumns = ['player', 'player_id', 'FGM/A*', 'FTM/A*', '3PTA*'];
  const [allPlayers, setAllPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const selectAllCheckboxRef = useRef(null);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false); // 【新增】使用說明浮動視窗的 State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false); // 【新增】圖片彈窗的 State
  const modalRef = useRef(null);
  const helpModalRef = useRef(null);
  const imageModalRef = useRef(null); // 【新增】圖片彈窗的 Ref


  // --- 資料讀取 Effect ---
  useEffect(() => {
    const csvFilePath = `/data/week${selectedWeek}.csv`;
    fetch(csvFilePath)
      .then((response) => {
        if (!response.ok) throw new Error(`找不到檔案: ${response.url}`);
        return response.text();
      })
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            const uniquePlayers = [...new Set(result.data.map(row => row.player))].sort();
            setHeaders(result.meta.fields);
            setData(result.data);
            setAllPlayers(uniquePlayers);
            setSelectedPlayers(new Set(uniquePlayers));
            setSortConfig({ key: null, direction: 'descending' });
          },
        });
      })
      .catch(error => {
        console.error("讀取或解析 CSV 時出錯:", error);
        setHeaders([]);
        setData([]);
      });
  }, [selectedWeek]);
  
  // --- 資料處理流程 ---

  // 1. 根據勾選的球員篩選資料
  const filteredData = useMemo(() => {
    return data.filter(row => selectedPlayers.has(row.player));
  }, [data, selectedPlayers]);

  // 2. 【核心修改】排序邏輯現在包含「實力排名」和「欄位排序」
  const sortedData = useMemo(() => {
    let dataToSort = [...filteredData];
    
    // 情況一：預設排序 (使用實力排名)
    if (sortConfig.key === null) {
      if (dataToSort.length < 2) return dataToSort;

      // 計算每個球員的勝負戰績
      const playerRankings = {};
      dataToSort.forEach(p => { playerRankings[p.player] = { wins: 0, losses: 0, ties: 0 }; });

      for (let i = 0; i < dataToSort.length; i++) {
        for (let j = i + 1; j < dataToSort.length; j++) {
          const playerA = dataToSort[i];
          const playerB = dataToSort[j];
          let scoreA = 0;
          let scoreB = 0;

          fantasyCategories.forEach(cat => {
            const valA = parseFloat(playerA[cat]) || 0;
            const valB = parseFloat(playerB[cat]) || 0;
            
            if (valA === valB) return;

            if (lowerIsBetterCategories.has(cat)) {
              if (valA < valB) scoreA++; else scoreB++;
            } else {
              if (valA > valB) scoreA++; else scoreB++;
            }
          });

          if (scoreA > scoreB) {
            playerRankings[playerA.player].wins++;
            playerRankings[playerB.player].losses++;
          } else if (scoreB > scoreA) {
            playerRankings[playerB.player].wins++;
            playerRankings[playerA.player].losses++;
          } else {
            playerRankings[playerA.player].ties++;
            playerRankings[playerB.player].ties++;
          }
        }
      }
      
      // 根據戰績排序
      dataToSort.sort((a, b) => {
        const rankA = playerRankings[a.player];
        const rankB = playerRankings[b.player];
        if (rankB.wins !== rankA.wins) {
          return rankB.wins - rankA.wins; // 勝場多的排前面
        }
        return rankA.losses - rankB.losses; // 勝場相同，敗場少的排前面
      });

    } else {
      // 情況二：使用者點擊欄位進行排序
      dataToSort.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        const numA = parseFloat(valA) || 0;
        const numB = parseFloat(valB) || 0;
        if (numA < numB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (numA > numB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return dataToSort;
  }, [filteredData, sortConfig]);

  // 3. 根據篩選後的資料計算最佳值 (依賴 filteredData)
  const highlightValues = useMemo(() => {
    if (filteredData.length === 0) return {};
    const bestValues = {};
    fantasyCategories.forEach(header => {
      if (!headers.includes(header)) return;
      const values = filteredData.map(row => parseFloat(row[header])).filter(value => !isNaN(value));
      if (values.length === 0) return;
      const findMin = lowerIsBetterCategories.has(header);
      const targetNumericValue = findMin ? Math.min(...values) : Math.max(...values);
      const targetRow = filteredData.find(row => parseFloat(row[header]) === targetNumericValue);
      if (targetRow) { bestValues[header] = targetRow[header]; }
    });
    return bestValues;
  }, [filteredData, headers]);

  // Effect 來處理「全選」checkbox 的中間狀態 (indeterminate)
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
        const numSelected = selectedPlayers.size;
        const numTotal = allPlayers.length;
        selectAllCheckboxRef.current.checked = numSelected === numTotal && numTotal > 0;
        selectAllCheckboxRef.current.indeterminate = numSelected > 0 && numSelected < numTotal;
    }
  }, [selectedPlayers, allPlayers]);

  // 【新增】Effect 來處理點擊外部關閉浮動視窗
  useEffect(() => {
    function handleClickOutside(event) {
      if (isFilterOpen && modalRef.current && !modalRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
      if (isHelpModalOpen && helpModalRef.current && !helpModalRef.current.contains(event.target)) {
        setIsHelpModalOpen(false);
      }
      if (isImageModalOpen && imageModalRef.current && !imageModalRef.current.contains(event.target)) {
        setIsImageModalOpen(false);
      }
    }
    if (isFilterOpen || isHelpModalOpen || isImageModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFilterOpen, isHelpModalOpen, isImageModalOpen]);


  // --- 事件處理函式 ---
  const handlePlayerSelection = (player) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(player)) { newSelection.delete(player); } else { newSelection.add(player); }
    setSelectedPlayers(newSelection);
  };

  const handleSelectAllInDropdown = (isSelect) => {
    if (isSelect) {
      setSelectedPlayers(new Set(allPlayers));
    } else {
      setSelectedPlayers(new Set());
    }
  };

  const handleSelectAllInTable = (event) => {
    if (event.target.checked) { setSelectedPlayers(new Set(allPlayers)); } else { setSelectedPlayers(new Set()); }
  };
  
  const resetToPowerRanking = () => {
    setSortConfig({ key: null, direction: 'descending' });
    setSelectedPlayers(new Set(allPlayers));
  };

  const requestSort = (key) => {
    const ascendingByDefault = ['TO', 'PF'];
    if (sortConfig.key !== key) {
      const defaultDirection = ascendingByDefault.includes(key) ? 'ascending' : 'descending';
      setSortConfig({ key, direction: defaultDirection });
    } else {
      if (sortConfig.direction === 'descending') {
          const newDirection = 'ascending';
          setSortConfig({ key, direction: newDirection });
      } else {
          resetToPowerRanking();
      }
    }
  };

  // 【新增】點擊特定玩家名稱時觸發的函式
  const handlePlayerNameClick = (playerName) => {
    if (playerName === '敢不敢不要比命中率') {
      setIsImageModalOpen(true);
    }
  };
  
  const handleWeekChange = (event) => { setSelectedWeek(Number(event.target.value)); };

  // --- JSX 渲染 ---
  return (
    <div className="App">
      <h1 className="Title">Fantasy Stats</h1>
      <div className="controls-container">
        <div className="week-selector-container">
          <select id="week-select" className="week-selector" value={selectedWeek} onChange={handleWeekChange}>
            {weekOptions.map(week => <option key={week} value={week}>Week {week}</option>)}
          </select>
        </div>
        <button className="power-ranking-button" onClick={resetToPowerRanking}>
          Power Ranking
        </button>
        {/* 【修改】按鈕現在只負責打開浮動視窗 */}
        <div className="player-filter-container">
          <button className="player-filter-button" onClick={() => setIsFilterOpen(true)}>
            Select Player ({selectedPlayers.size} / {allPlayers.length})
          </button>
        </div>
        {/* 【新增】使用說明按鈕 */}
        <button className="help-button" onClick={() => setIsHelpModalOpen(true)}>
          ?
        </button>
      </div>

      {/* 【新增】浮動視窗的 JSX 結構 */}
      {isFilterOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" ref={modalRef}>
            <div className="player-filter-actions">
              <button onClick={() => handleSelectAllInDropdown(true)}>Select All</button>
              <button onClick={() => handleSelectAllInDropdown(false)}>Cancel All</button>
            </div>
            <ul className="player-filter-list">
              {allPlayers.map(player => (
                <li key={player}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedPlayers.has(player)}
                      onChange={() => handlePlayerSelection(player)}
                    />
                    {player}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* 【新增】使用說明的浮動視窗 */}
      {isHelpModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" ref={helpModalRef}>
            <h2 className="modal-title">使用說明</h2>
            <div className="help-content">
              <ul>
                <li><strong>Power Ranking:</strong> 此為預設排序。綜合比較所有勾選球員的12項數據，計算出當週的綜合實力排名。點擊此按鈕可隨時返回此預設排序，並重新勾選所有球員。</li>
                <li><strong>欄位排序:</strong> 點擊表格頭部 (如 PTS, REB) 可依該項數據進行排序。第一次點擊為降冪 (高到低)，第二次為升冪 (低到高)，第三次點擊則返回 Power Ranking。</li>
                <li><strong>球員勾選:</strong>
                  <ul>
                    <li>您可以透過表格左側的勾選框，或點擊「Select Player」按鈕來篩選想比較的球員，點擊畫面外的任意地方可以關閉視窗。</li>
                    <li>所有排名與數據最佳值，皆會根據您當前勾選的球員即時重新計算。</li>
                  </ul>
                </li>
                <li><strong>數據突顯:</strong> 表格中帶有顏色的儲存格，代表該項數據在目前所有「已勾選」的球員中的最佳值。</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="power-ranking-button" onClick={() => setIsHelpModalOpen(false)}>關閉</button>
            </div>
          </div>
        </div>
      )}

      {/* 【新增】圖片顯示的浮動視窗 */}
      {isImageModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsImageModalOpen(false)}>
          <div className="image-modal-content" ref={imageModalRef} onClick={(e) => e.stopPropagation()}>
            <img src={'/LebronSunshine.jpg'} alt="彩蛋照片" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input type="checkbox" ref={selectAllCheckboxRef} onChange={handleSelectAllInTable} title="全選/全不選" />
              </th>
              {headers.map((header) => {
                const isSortable = !nonSortableColumns.includes(header);
                return (
                  <th key={header} className={isSortable ? `sortable ${sortConfig.key === header ? 'sorted-by' : ''}` : ''} onClick={isSortable ? () => requestSort(header) : undefined}>
                    {header}
                    {isSortable && sortConfig.key === header && (<span>{sortConfig.direction === 'descending' ? ' ▼' : ' ▲'}</span>)}
                  </th>
                );
              })}
            </tr>
          </thead>
           <tbody>
            {sortedData.map((row) => (
              <tr key={row.player_id || row.player}>
                <td className="checkbox-cell">
                  <input type="checkbox" checked={selectedPlayers.has(row.player)} onChange={() => handlePlayerSelection(row.player)} />
                </td>
                {headers.map((header) => {
                  const cellValue = row[header];
                  const isHighlighted = highlightValues[header] === cellValue;
                  
                  // 【修改】針對特定玩家和欄位進行特殊處理
                  if (header === 'player') {
                    const isSpecialPlayer = cellValue === '敢不敢不要比命中率';
                    return (
                      <td 
                        key={header}
                        className={`${isHighlighted ? 'highlight-cell' : ''} ${isSpecialPlayer ? 'special-player' : ''}`}
                        onClick={isSpecialPlayer ? () => handlePlayerNameClick(cellValue) : undefined}
                      >
                        {cellValue}
                      </td>
                    );
                  }

                  return (
                    <td key={header} className={isHighlighted ? 'highlight-cell' : ''}>
                      {cellValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody> 
        </table>
      </div>
    </div>
  );
}

export default App;